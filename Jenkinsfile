pipeline {
    agent any
    options { disableConcurrentBuilds() }
    triggers { pollSCM('H/2 * * * *') }

    environment {
        TEST_DATABASE_URL = 'postgresql+psycopg2://opsguard_user:opsguard_password@localhost:5432/opsguard_test_db'
    }

    stages {
        stage('Checkout') {
            steps { checkout scm }
        }

        stage('Install dependencies') {
            steps {
                dir('backend') {
                    bat 'python -m venv venv'
                    bat 'venv\\Scripts\\python -m pip install --upgrade pip'
                    bat 'venv\\Scripts\\python -m pip install -r requirements.txt'
                }
            }
        }

        stage('Backend tests') {
            steps {
                dir('backend') {
                    bat 'venv\\Scripts\\python -m pytest -v --junitxml=test-results.xml'
                }
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: 'backend/test-results.xml'
                }
            }
        }

        stage('Backend build check') {
            steps {
                dir('backend') {
                    // Fails if any Python file has a syntax error.
                    bat 'venv\\Scripts\\python -m compileall -q app'
                }
            }
        }

        stage('Worker tests') {
            environment {
                REDIS_URL = 'redis://localhost:6379/0'
                REDIS_QUEUE = 'opsguard:monitoring:jobs'
                DATABASE_URL = 'postgresql://opsguard_user:opsguard_password@localhost:5432/opsguard_test_db'
            }
            steps {
                dir('worker') {
                    bat 'python -m venv venv'
                    bat 'venv\\Scripts\\python -m pip install --upgrade pip'
                    bat 'venv\\Scripts\\python -m pip install -r requirements.txt'
                    bat 'venv\\Scripts\\python -m pytest -v --junitxml=test-results.xml'
                }
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: 'worker/test-results.xml'
                }
            }
        }

        stage('Observability tests (M4)') {
            steps {
                // A failure marks the build unstable, not failed.
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                    bat 'backend\\venv\\Scripts\\python -m pytest -v tests\\test_observability.py'
                }
            }
        }

        stage('Docker build') {
            steps {
                bat 'docker build -t opsguard-backend:%BUILD_NUMBER% backend'
                bat 'docker build -t opsguard-worker:%BUILD_NUMBER% worker'
                bat 'docker build -t opsguard-frontend:%BUILD_NUMBER% frontend'
            }
        }

        stage('Docker Hub push') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-creds',
                        usernameVariable: 'DOCKERHUB_USERNAME',
                        passwordVariable: 'DOCKERHUB_TOKEN'
                    )
                ]) {
                    bat '''
                        @echo off
                        echo Docker Hub username: [%DOCKERHUB_USERNAME%]

                        docker login -u %DOCKERHUB_USERNAME% -p %DOCKERHUB_TOKEN%
                        if errorlevel 1 exit /b 1

                        docker tag opsguard-backend:%BUILD_NUMBER% %DOCKERHUB_USERNAME%/opsguard-backend:build-%BUILD_NUMBER%
                        if errorlevel 1 exit /b 1
                        docker tag opsguard-worker:%BUILD_NUMBER% %DOCKERHUB_USERNAME%/opsguard-worker:build-%BUILD_NUMBER%
                        if errorlevel 1 exit /b 1
                        docker tag opsguard-frontend:%BUILD_NUMBER% %DOCKERHUB_USERNAME%/opsguard-frontend:build-%BUILD_NUMBER%
                        if errorlevel 1 exit /b 1

                        docker push %DOCKERHUB_USERNAME%/opsguard-backend:build-%BUILD_NUMBER%
                        if errorlevel 1 exit /b 1
                        docker push %DOCKERHUB_USERNAME%/opsguard-worker:build-%BUILD_NUMBER%
                        if errorlevel 1 exit /b 1
                        docker push %DOCKERHUB_USERNAME%/opsguard-frontend:build-%BUILD_NUMBER%
                        if errorlevel 1 exit /b 1

                        docker logout
                    '''
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-creds',
                        usernameVariable: 'DOCKERHUB_USERNAME',
                        passwordVariable: 'DOCKERHUB_TOKEN'
                    ),
                    file(credentialsId: 'kubeconfig-docker-desktop', variable: 'KUBECONFIG')
                ]) {
                    bat '''
                        @echo off
                        kubectl get nodes
                        if errorlevel 1 exit /b 1

                        REM Load M2's manifests (creates anything missing).
                        kubectl apply -f kubernetes/
                        if errorlevel 1 exit /b 1

                        REM Point each Deployment at the image pushed in the previous stage.
                        kubectl set image deployment/backend backend=%DOCKERHUB_USERNAME%/opsguard-backend:build-%BUILD_NUMBER%
                        if errorlevel 1 exit /b 1
                        kubectl set image deployment/frontend frontend=%DOCKERHUB_USERNAME%/opsguard-frontend:build-%BUILD_NUMBER%
                        if errorlevel 1 exit /b 1
                        kubectl set image deployment/worker worker=%DOCKERHUB_USERNAME%/opsguard-worker:build-%BUILD_NUMBER%
                        if errorlevel 1 exit /b 1

                        REM Wait until the new pods are healthy; fails the stage if they are not.
                        kubectl rollout status deployment/backend --timeout=180s
                        if errorlevel 1 exit /b 1
                        kubectl rollout status deployment/frontend --timeout=180s
                        if errorlevel 1 exit /b 1
                        kubectl rollout status deployment/worker --timeout=180s
                        if errorlevel 1 exit /b 1

                        kubectl get pods
                        kubectl get deployments -o wide
                    '''
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline finished: all stages passed.'
        }
        failure {
            echo 'Pipeline failed: open the red stage and read the log.'
        }
    }
}