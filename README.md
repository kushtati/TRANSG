# E-Trans v3.0 - Déploiement Séparé

**Backend** → Railway (API + PostgreSQL)  
**Frontend** → Vercel (React + Vite)

---

## 🚀 ÉTAPE 1 : Déployer le Backend sur Railway

### 1.1 Préparer le code

```bash
cd backend
git init
git add .
git commit -m "Initial backend"
```

### 1.2 Créer le projet Railway

1. Aller sur [railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub repo"
3. Connecter le repo `backend`

### 1.3 Ajouter PostgreSQL

1. Dans Railway, cliquer "Add Service" → "Database" → "PostgreSQL"
2. Railway crée automatiquement `DATABASE_URL`

### 1.4 Variables d'environnement Backend

Dans Railway → "Variables" :

```
JWT_SECRET=<générer: openssl rand -base64 32>
REFRESH_TOKEN_SECRET=<générer une autre clé>
NODE_ENV=production
FRONTEND_URL=https://votre-app.vercel.app
```

⚠️ **IMPORTANT** : `FRONTEND_URL` doit pointer vers l'URL Vercel (configuré après)

### 1.5 Déployer

Railway déploie automatiquement. Notez l'URL générée :
```
https://votre-backend-xxx.railway.app
```

### 1.6 Initialiser la base de données

```bash
# Récupérer DATABASE_URL depuis Railway
export DATABASE_URL="postgresql://..."

npx prisma db push
npm run db:seed
```

---

## 🚀 ÉTAPE 2 : Déployer le Frontend sur Vercel

### 2.1 Préparer le code

```bash
cd frontend
git init
git add .
git commit -m "Initial frontend"
```

### 2.2 Créer le projet Vercel

1. Aller sur [vercel.com](https://vercel.com)
2. "Add New Project"
3. Importer le repo `frontend`

### 2.3 Variable d'environnement Frontend

Dans Vercel → "Settings" → "Environment Variables" :

```
VITE_API_URL=https://votre-backend-xxx.railway.app/api
```

⚠️ Utilisez l'URL Railway de l'étape 1.5

### 2.4 Déployer

Vercel build et déploie automatiquement.  
Notez l'URL générée :
```
https://votre-app.vercel.app
```

---

## 🔗 ÉTAPE 3 : Lier Backend et Frontend

### 3.1 Mettre à jour Railway

Dans Railway → "Variables", mettre à jour :
```
FRONTEND_URL=https://votre-app.vercel.app
```

⚠️ **CRITIQUE** : Sans cette étape, les cookies CORS ne fonctionneront pas !

### 3.2 Redéployer le backend

Dans Railway, cliquez "Deploy" pour appliquer les changements.

---

## ✅ VÉRIFICATION

1. Ouvrir `https://votre-app.vercel.app`
2. Créer un compte ou se connecter avec :
   - **Email:** admin@emergence-transit.com
   - **Password:** Admin123!

---

## 📁 Structure des fichiers

```
e-trans-split/
├── backend/                    # → Railway
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── server/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── index.ts
│   ├── package.json
│   ├── railway.toml
│   └── tsconfig.json
│
├── frontend/                   # → Vercel
│   ├── src/
│   │   ├── App.tsx
│   │   ├── lib/api.ts
│   │   └── types/
│   ├── package.json
│   ├── vercel.json
│   ├── vite.config.ts
│   └── index.html
│
└── README.md
```

---

## 🔧 Développement local

### Terminal 1 - Backend
```bash
cd backend
npm install
cp .env.example .env
# Éditer .env avec DATABASE_URL local
npm run dev
```

### Terminal 2 - Frontend
```bash
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5000

---

## 🔐 Variables d'environnement récapitulatif

### Backend (Railway)
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Auto (Railway PostgreSQL) |
| `JWT_SECRET` | Clé JWT (32+ caractères) |
| `REFRESH_TOKEN_SECRET` | Clé refresh (32+ caractères) |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | URL Vercel (pour CORS) |
| `RESEND_API_KEY` | Optionnel (emails) |
| `GEMINI_API_KEY` | Optionnel (IA) |

### Frontend (Vercel)
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | URL Backend Railway + `/api` |

---

## ❓ Troubleshooting

### "CORS Error" / "Cookies not sent"
→ Vérifier que `FRONTEND_URL` dans Railway correspond exactement à l'URL Vercel

### "Network Error"
→ Vérifier que `VITE_API_URL` dans Vercel pointe vers le bon backend

### "401 Unauthorized" après refresh
→ Vérifier que les cookies sont bien configurés (SameSite, Secure)

---

## 📝 License

MIT © 2026 Emergence Transit Guinée
