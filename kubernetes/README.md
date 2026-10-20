# Kubernetes (Docker Desktop)

Worker deployment, liveness probe, scaling and self-healing: Member 2.

| File | What it runs |
|---|---|
| `redis.yaml` | Redis job queue |
| `postgres.yaml` | PostgreSQL + 1Gi volume |
| `backend.yaml` | FastAPI backend, published on `localhost:8000` |
| `worker.yaml` | Monitoring worker + liveness probe on `/health` (port 8081) |
| `frontend.yaml` | Next.js frontend, published on `localhost:3000` |
| `demo-target.yaml` | Optional tiny website for the recovery demo |

## 1. One-time setup

1. Docker Desktop -> Settings -> Kubernetes -> tick **Enable Kubernetes** -> wait until green.
2. `kubectl get nodes` should show `docker-desktop   Ready`.
3. Stop Docker Compose if it is running (it uses the same ports 3000, 8000, 8081):
   ```
   docker compose down
   ```
4. Build the local images (the manifests use them with `imagePullPolicy: Never`):
   ```
   docker compose build
   docker images | grep opsguard      # opsguard-backend:v1, opsguard-worker:v1, opsguard-frontend:v1
   ```
5. Create the JWT secret (kept out of the repo because it is public):
   ```
   kubectl create secret generic opsguard-secrets --from-literal=JWT_SECRET_KEY=any-long-random-string
   ```
   Optional alert settings can be added to the same secret later:
   `SENDER_EMAIL`, `SENDER_PASSWORD`, `SLACK_WEBHOOK_URL`.

## 2. Deploy (in this order)

```
kubectl apply -f kubernetes/redis.yaml
kubectl apply -f kubernetes/postgres.yaml
kubectl wait --for=condition=Ready pod -l app=postgres --timeout=120s
kubectl apply -f kubernetes/backend.yaml
kubectl wait --for=condition=Ready pod -l app=backend --timeout=120s
kubectl apply -f kubernetes/worker.yaml
kubectl apply -f kubernetes/frontend.yaml
kubectl apply -f kubernetes/demo-target.yaml
kubectl get pods
```

All pods should reach `Running` / `1/1`. Open http://localhost:3000 and http://localhost:8000/docs.

> Screenshot 1: `kubectl get pods` with everything Running.

## 3. Check the worker probe

```
kubectl describe deployment worker | grep -i liveness
kubectl logs deployment/worker --tail=20
```

## 4. Scaling demo (1 -> 2 -> 3 workers)

```
kubectl get pods -l app=worker
kubectl scale deployment worker --replicas=2
kubectl get pods -l app=worker
kubectl scale deployment worker --replicas=3
kubectl get pods -l app=worker
```

Each worker logs its own pod name (`Starting OpsGuard worker: worker-xxxxx`), and several
workers never run the same check twice.

> Screenshot 2: `kubectl get pods -l app=worker` showing 3 worker pods.

## 5. Self-healing demo

Use two terminals.

Terminal A (watch):
```
kubectl get pods -l app=worker -w
```
Terminal B (kill one worker):
```
kubectl delete pod <one-worker-pod-name>
```
Terminal A shows that pod `Terminating` and a new pod appear, back to 3 workers.

> Screenshot 3: terminal A showing the pod being replaced.

Optional, to show the liveness probe / container restart (RESTARTS goes 0 -> 1):
```
kubectl exec <worker-pod-name> -- kill 1
kubectl get pods -l app=worker
```

## 6. Recovery demo (DOWN -> HEALTHY, incident RESOLVED)

Get a token and add the demo site as a monitored endpoint:
```
curl -X POST localhost:8000/auth/signup -H "Content-Type: application/json" \
  -d '{"name":"M2","email":"m2@test.com","password":"password123"}'

TOKEN=$(curl -s -X POST localhost:8000/auth/login -H "Content-Type: application/json" \
  -d '{"email":"m2@test.com","password":"password123"}' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

curl -X POST localhost:8000/endpoints -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Demo site","url":"http://demo-target","check_interval":30,"fast_check_interval":5}'
```
(On Windows PowerShell it is easier to use the frontend at http://localhost:3000 or http://localhost:8000/docs.)

Then:
```
# 1. healthy
curl -H "Authorization: Bearer $TOKEN" localhost:8000/endpoints/1          # current_state HEALTHY

# 2. break it
kubectl scale deployment demo-target --replicas=0
# wait ~15-20 seconds (2 failed checks needed, checked every 5s while failing)
curl -H "Authorization: Bearer $TOKEN" localhost:8000/endpoints/1          # current_state DOWN
curl -H "Authorization: Bearer $TOKEN" localhost:8000/incidents            # status OPEN

# 3. fix it
kubectl scale deployment demo-target --replicas=1
# wait ~10-20 seconds
curl -H "Authorization: Bearer $TOKEN" localhost:8000/endpoints/1          # current_state HEALTHY
curl -H "Authorization: Bearer $TOKEN" localhost:8000/incidents            # status RESOLVED

kubectl logs -l app=worker --tail=30 --prefix
```
The worker logs show the check interval going down to 5s while DOWN, then back to 30s once HEALTHY.

> Screenshot 4: DOWN + OPEN incident. Screenshot 5: HEALTHY + RESOLVED incident + the interval going back to normal in the logs.

## Notes

- The worker has `/health` (used by the liveness probe) but no `/metrics` page yet.
- The `worker` Service (port 8081) exists so Prometheus/Grafana can reach the workers later.
- Reset everything: `kubectl delete -f kubernetes/` (add `kubectl delete pvc postgres-pvc` to wipe the database).
