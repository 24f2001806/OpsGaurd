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
                always { junit allowEmptyResults: true, testResults: 'backend/test-results.xml' }
            }
        }
    }
}