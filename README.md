<<<<<<< HEAD
# iMeetPro Infrastructure & CI/CD Setup

## 📋 Overview

Complete infrastructure setup for iMeetPro video conferencing platform using:
- **Infrastructure as Code**: Terraform
- **Container Orchestration**: AWS EKS (Kubernetes)
- **CI/CD**: Jenkins
- **Container Registry**: AWS ECR
- **Monitoring**: Prometheus + Grafana + Loki

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud (ap-south-1)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                           VPC (10.0.0.0/16)                             │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │ │
│  │  │ Public Subnet   │  │ Private Subnet  │  │ Database Subnet │         │ │
│  │  │ 10.0.101.0/24   │  │ 10.0.1.0/24     │  │ 10.0.201.0/24   │         │ │
│  │  │                 │  │                 │  │                 │         │ │
│  │  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │         │ │
│  │  │ │     ALB     │ │  │ │  EKS Nodes  │ │  │ │  RDS MySQL  │ │         │ │
│  │  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │         │ │
│  │  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │                 │         │ │
│  │  │ │ NAT Gateway │ │  │ │  GPU Nodes  │ │  │                 │         │ │
│  │  │ └─────────────┘ │  │ └─────────────┘ │  │                 │         │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │     ECR      │  │      S3      │  │  CloudFront  │  │   Route 53   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            EKS Cluster                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                        Namespace: imeetpro                              │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │
│  │  │ Frontend │  │ Backend  │  │  Celery  │  │   GPU    │                │ │
│  │  │ (React)  │  │ (Django) │  │ Workers  │  │ Workers  │                │ │
│  │  │  x3 pods │  │  x3 pods │  │  x2 pods │  │  x2 pods │                │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                       Namespace: databases                              │ │
│  │  ┌──────────────────────┐  ┌──────────────────────┐                    │ │
│  │  │      MongoDB         │  │        Redis         │                    │ │
│  │  │   (StatefulSet x3)   │  │   (StatefulSet x3)   │                    │ │
│  │  └──────────────────────┘  └──────────────────────┘                    │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                       Namespace: monitoring                             │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐            │ │
│  │  │Prometheus│  │ Grafana  │  │   Loki   │  │ AlertManager │            │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────┘            │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
imeetpro-infra/
├── terraform/                    # Infrastructure as Code
│   ├── modules/
│   │   ├── vpc/                 # VPC, Subnets, NAT
│   │   ├── eks/                 # EKS Cluster
│   │   ├── ecr/                 # Container Registry
│   │   ├── rds/                 # MySQL Database
│   │   ├── s3/                  # S3 Buckets
│   │   ├── cloudfront/          # CDN
│   │   └── security/            # Security Groups, WAF
│   ├── environments/
│   │   ├── dev/
│   │   ├── staging/
│   │   └── prod/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── providers.tf
│
├── jenkins/                      # CI/CD Configuration
│   ├── pipelines/
│   │   └── Jenkinsfile          # Main CI/CD Pipeline
│   ├── scripts/
│   │   ├── install-jenkins.sh   # Jenkins Installation
│   │   └── setup-credentials.sh # Credentials Setup
│   └── docker/
│       ├── Dockerfile.frontend
│       ├── Dockerfile.backend
│       ├── Dockerfile.celery
│       ├── Dockerfile.gpu-worker
│       └── nginx/
│
├── kubernetes/                   # Kubernetes Manifests
│   ├── namespaces/
│   ├── apps/
│   │   ├── frontend/
│   │   ├── backend/
│   │   ├── celery/
│   │   └── gpu-workers/
│   ├── databases/
│   │   ├── mongodb/
│   │   └── redis/
│   ├── monitoring/
│   ├── ingress/
│   └── secrets/
│
└── scripts/
    └── deploy.sh                # Master Deployment Script
```

---

## 🚀 Quick Start

### Prerequisites

```bash
# Install required tools
# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# Terraform
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip && sudo mv terraform /usr/local/bin/

# kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

### Configure AWS

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Default region: ap-south-1
# Default output format: json
```

### Deploy Infrastructure

```bash
# Clone the repository
git clone https://github.com/your-org/imeetpro-infra.git
cd imeetpro-infra

# Set environment variables
export AWS_REGION=ap-south-1
export ENVIRONMENT=prod

# Run deployment
chmod +x scripts/deploy.sh
./scripts/deploy.sh all
```

---

## 🔧 Terraform Commands

```bash
cd terraform

# Initialize
terraform init

# Plan
terraform plan -var-file="environments/prod/terraform.tfvars"

# Apply
terraform apply -var-file="environments/prod/terraform.tfvars"

# Destroy (careful!)
terraform destroy -var-file="environments/prod/terraform.tfvars"

# Show outputs
terraform output
```

---

## 🔄 CI/CD Pipeline Stages

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Checkout   │───▶│  Code Scan   │───▶│    Build     │───▶│Security Scan │
│   (GitHub)   │    │ (SonarQube)  │    │  (Docker)    │    │   (Trivy)    │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                                                    │
                                                                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Smoke Tests  │◀───│   Deploy     │◀───│  Push ECR    │◀───│   Unit Test  │
│              │    │   (EKS)      │    │              │    │              │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

### Pipeline Features

| Stage | Tool | Description |
|-------|------|-------------|
| Checkout | Git | Pull code from GitHub |
| Code Quality | SonarQube | Static code analysis |
| Unit Tests | Jest/Pytest | Run unit tests |
| Build | Docker | Build container images |
| Security Scan | Trivy | Vulnerability scanning |
| Push | ECR | Push images to registry |
| Deploy | kubectl | Deploy to EKS |
| Smoke Tests | curl | Verify deployment |

---

## 🖥️ Jenkins Setup

### Install Jenkins

```bash
# On EC2 instance (t3.large recommended)
chmod +x jenkins/scripts/install-jenkins.sh
./jenkins/scripts/install-jenkins.sh
```

### Required Plugins

- Docker Pipeline
- Kubernetes
- AWS Steps
- Pipeline: AWS Steps
- SonarQube Scanner
- Slack Notification
- Blue Ocean
- Git
- Credentials Binding

### Configure Credentials

1. Go to Jenkins → Manage Jenkins → Credentials
2. Add the following credentials:

| Credential ID | Type | Description |
|--------------|------|-------------|
| `aws-credentials` | Username/Password | AWS Access Key |
| `aws-account-id` | Secret Text | AWS Account ID |
| `github-credentials` | Username/Password | GitHub Token |
| `sonar-token` | Secret Text | SonarQube Token |
| `slack-token` | Secret Text | Slack Webhook |

---

## 📊 Monitoring

### Access Grafana

```bash
# Port forward
kubectl port-forward svc/monitoring-grafana 3000:80 -n monitoring

# Access at http://localhost:3000
# Username: admin
# Password: kubectl get secret -n monitoring monitoring-grafana -o jsonpath="{.data.admin-password}" | base64 --decode
```

### Pre-configured Dashboards

| Dashboard ID | Name |
|-------------|------|
| 1860 | Node Exporter |
| 2583 | MongoDB |
| 763 | Redis |
| 9528 | Django |
| 6417 | Kubernetes |

### Alert Rules

- High CPU (>80%)
- Low Memory (<20% available)
- Pod Crashes
- High Error Rate (>5%)
- Slow API Response (>2s)
- Database Connections

---

## 💰 Cost Estimation

| Component | Instance/Type | Monthly Cost |
|-----------|--------------|--------------|
| EKS Control Plane | - | $73 |
| EKS Nodes (3x t3.large) | t3.large | $180 |
| GPU Nodes (2x g4dn.xlarge) | g4dn.xlarge | $780 |
| RDS MySQL | db.t3.medium | $50 |
| NAT Gateway | - | $100 |
| S3 + CloudFront | - | $62 |
| Data Transfer | 10TB | $180 |
| LiveKit Cloud | - | $600 |
| **Total** | | **~$2,025/month** |

---

## 🔐 Security Features

- ✅ Private subnets for all workloads
- ✅ WAF protection
- ✅ SSL/TLS everywhere
- ✅ Network policies
- ✅ RBAC enabled
- ✅ Secrets encryption (KMS)
- ✅ Image vulnerability scanning
- ✅ Pod security standards

---

## 📞 Support

- **Documentation**: [docs.imeetpro.com](https://docs.imeetpro.com)
- **Issues**: [GitHub Issues](https://github.com/your-org/imeetpro-infra/issues)
- **Slack**: #imeetpro-devops

---

## 📝 License

Copyright © 2024 iMeetPro. All rights reserved.
=======
# Video Meeting App Frontend

A professional Google Meet-like video meeting application built with React, Material-UI, and WebRTC.

## 🚀 Features

### 📱 Main Features
- **Multiple Meeting Types**: Instant, Scheduled, and Calendar-integrated meetings
- **HD Video/Audio**: Professional quality video conferencing with adaptive streaming
- **Real-time Chat**: Text messaging, file sharing, and emoji integration
- **Screen Sharing**: Full screen, window, or tab sharing capabilities
- **Interactive Reactions**: Emoji reactions with animations
- **AI-Powered Analytics**: Attendance tracking and engagement metrics
- **Recording & Transcription**: Local and cloud recording with automatic transcription
- **Waiting Room**: Pre-meeting lobby with device testing
- **Calendar Integration**: Google Calendar, Outlook, and Apple Calendar sync

### 🎛️ Meeting Controls
- **Host Controls**: Participant management, mute/unmute, remove participants, recording control
- **Participant Controls**: Self mute/unmute, camera on/off, chat, reactions, raise hand
- **Advanced Permissions**: Role-based access control and dynamic permission management

### 🔧 Technical Features
- **Responsive Design**: Mobile-first approach with cross-device compatibility
- **Real-time Communication**: WebRTC for peer-to-peer communication
- **WebSocket Integration**: Real-time updates and notifications
- **Progressive Web App**: Offline support and app-like experience
- **Accessibility**: WCAG compliant with screen reader support

## 🛠️ Technology Stack

- **Frontend Framework**: React 18 + Vite
- **UI Library**: Material-UI (MUI) v5
- **Routing**: React Router v6
- **State Management**: React Context API
- **Real-time**: Socket.io Client + WebRTC
- **Styling**: Emotion + CSS-in-JS
- **Testing**: Jest + React Testing Library
- **Build Tool**: Vite
- **Package Manager**: npm/yarn

## 📋 Prerequisites

- Node.js (v16.0.0 or higher)
- npm (v8.0.0 or higher) or yarn
- Modern web browser with WebRTC support

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/meeting-app-frontend.git
cd meeting-app-frontend
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
```

### 3. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your configuration
nano .env
```

### 4. Start Development Server
```bash
npm run dev
# or
yarn dev
```

The application will be available at `http://localhost:5173`

## 🏗️ Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── auth/           # Authentication components
│   ├── dashboard/      # Dashboard components
│   ├── meeting/        # Meeting creation & management
│   ├── scheduling/     # Meeting scheduling components
│   ├── calendar/       # Calendar integration
│   ├── invitations/    # Invitation management
│   ├── video/          # Video streaming components
│   ├── controls/       # Meeting controls
│   ├── reactions/      # Reactions & emoji system
│   ├── chat/           # Chat system
│   ├── participants/   # Participant management
│   ├── interactions/   # Interactive features
│   ├── recording/      # Recording & playback
│   ├── analytics/      # AI analytics & metrics
│   └── common/         # Shared components
├── pages/              # Page-level components
├── services/           # API & external services
├── hooks/              # Custom React hooks
├── context/            # React Context providers
├── utils/              # Utility functions
├── theme/              # Material-UI theme
├── layouts/            # Layout components
└── assets/             # Static assets
```

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run preview         # Preview production build

# Testing
npm run test            # Run tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage

# Code Quality
npm run lint            # Run ESLint
npm run lint:fix        # Fix ESLint issues
```

## 🌐 Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# API Configuration
VITE_API_BASE_URL=https://www.lancieretech.com/api
VITE_WS_BASE_URL=ws://www.lancieretech.com/ws/meeting/(?P<meeting_id>[^/]+)/$

# WebRTC Configuration
VITE_STUN_SERVERS=stun:stun.l.google.com:19302
VITE_TURN_SERVERS=turn:your-turn-server.com:3478

# Calendar Integration
VITE_GOOGLE_CALENDAR_CLIENT_ID=your-google-client-id
VITE_MICROSOFT_CALENDAR_CLIENT_ID=your-microsoft-client-id

# App Configuration
VITE_APP_NAME=Meeting App
VITE_MAX_PARTICIPANTS=50
VITE_MAX_MEETING_DURATION=180
```

## 📱 Component Architecture

### Core Components

#### Authentication Flow
- `Login.jsx` - User login form
- `Register.jsx` - User registration
- `ForgotPassword.jsx` - Password reset
- `EmailVerification.jsx` - Email verification

#### Meeting Management
- `CreateMeeting.jsx` - Meeting creation interface
- `JoinMeeting.jsx` - Meeting join interface
- `WaitingRoom.jsx` - Pre-meeting lobby
- `MeetingRoom.jsx` - Main meeting interface

#### Video System
- `VideoPlayer.jsx` - Individual video stream
- `VideoGrid.jsx` - Multiple participant layout
- `ScreenShare.jsx` - Screen sharing functionality
- `VideoQuality.jsx` - Quality controls

#### Communication
- `ChatPanel.jsx` - Chat interface
- `MessageList.jsx` - Message display
- `ReactionsPanel.jsx` - Emoji reactions
- `ParticipantsList.jsx` - Participant management

## 🔌 API Integration

### Authentication Endpoints
```javascript
POST /api/auth/login
POST /api/auth/register
POST /api/auth/verify-email
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

### Meeting Endpoints
```javascript
POST /api/meetings/create
GET  /api/meetings/:id
POST /api/meetings/:id/join
PUT  /api/meetings/:id/update
DELETE /api/meetings/:id
```

### Real-time Events
```javascript
// WebSocket Events
user-joined
user-left
message-sent
screen-share-started
participant-muted
recording-started
hand-raised
reaction-sent
```

## 🎨 Theming & Customization

The app uses Material-UI's theming system:

```javascript
// theme/theme.js
export const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  },
});
```

## 📱 Responsive Design

- **Mobile First**: Optimized for mobile devices
- **Breakpoints**: 
  - xs: 0px
  - sm: 600px
  - md: 900px
  - lg: 1200px
  - xl: 1536px

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- Login.test.jsx

# Run tests with coverage
npm run test:coverage
```

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Netlify
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

### Deploy to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Input Validation**: Client-side form validation
- **XSS Protection**: Sanitized user inputs
- **CORS Configuration**: Cross-origin request security
- **HTTPS Enforcement**: SSL/TLS encryption

## 🎯 Performance Optimization

- **Code Splitting**: Lazy loading of components
- **Bundle Optimization**: Webpack optimization
- **Image Optimization**: Compressed assets
- **Caching Strategy**: Browser and service worker caching
- **Virtual Scrolling**: Efficient list rendering

## 📊 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, email support@yourapp.com or join our Slack channel.

## 🙏 Acknowledgments

- [React](https://reactjs.org/)
- [Material-UI](https://mui.com/)
- [WebRTC](https://webrtc.org/)
- [Socket.io](https://socket.io/)
- [Vite](https://vitejs.dev/)

---

Built with ❤️ by Your Development Team
>>>>>>> feature/Frontend-UI
