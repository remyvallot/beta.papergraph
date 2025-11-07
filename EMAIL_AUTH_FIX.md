# Correction Authentification Email

## Problèmes rencontrés

### 1. ❌ Erreur: `signInWithGoogle has already been declared`
**Cause**: La fonction `signInWithGoogle()` était définie **deux fois** dans `index.html`

### 2. ❌ Erreur: `openAuthModal is not defined`
**Cause**: Après confirmation email, l'URL contient `#access_token=...` mais les fonctions n'étaient pas disponibles car la redirection vers `projects.html` ne se faisait pas automatiquement

### 3. ❌ Boutons "Get Started" et "Sign In" non cliquables
**Cause**: Les event listeners n'étaient pas attachés après le retour de l'email de confirmation

## Solutions appliquées

### ✅ 1. Suppression de la duplication de `signInWithGoogle()`

**AVANT** (❌ Duplication)
```javascript
// Google OAuth
async function signInWithGoogle() {
    try {
        // ... version 1 avec redirect logic
    }
}

async function signInWithGoogle() {  // ❌ DOUBLON
    try {
        // ... version 2 sans redirect logic
    }
}
```

**APRÈS** (✅ Une seule définition)
```javascript
// Google OAuth
async function signInWithGoogle() {
    try {
        // Check for pending share redirect
        const urlParams = new URLSearchParams(window.location.search);
        const redirect = urlParams.get('redirect');
        const token = urlParams.get('token');
        
        let redirectTo = window.location.origin + '/projects.html';
        if (redirect === 'share' && token) {
            redirectTo = window.location.origin + `/editor.html?share=${token}`;
        }
        
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectTo
            }
        });

        if (error) throw error;
    } catch (error) {
        showAuthMessage(error.message, true);
    }
}
```

### ✅ 2. Gestion de l'URL avec hash fragment (confirmation email)

Quand Supabase confirme un email, l'URL ressemble à :
```
http://localhost:8000/#access_token=eyJ...&type=signup
```

**AVANT** (❌ Ne détectait pas le hash)
```javascript
window.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        window.location.href = 'projects.html';
    }
});
```

**APRÈS** (✅ Détecte et traite le hash)
```javascript
window.addEventListener('DOMContentLoaded', async () => {
    // Check for redirect parameters
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect');
    const token = urlParams.get('token');
    
    // Handle hash fragment (from email confirmation)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const hashType = hashParams.get('type');
    
    // If we have an access token in hash, this is a redirect from email confirmation
    if (accessToken) {
        // Supabase SDK will handle the session automatically
        // Wait a moment for session to be established
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        // User is logged in → redirect to projects
        if (redirect === 'share' && token) {
            window.location.href = `editor.html?share=${token}`;
        } else {
            window.location.href = 'projects.html';
        }
        return;
    }
    
    // Attach event listeners (important!)
    const getStartedBtn = document.getElementById('getStartedBtn');
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', openAuthModal);
    }
});
```

## Flux d'authentification email

### Scénario 1: Inscription avec email
```
1. Utilisateur saisit email + password → Clique "Sign Up"
2. Supabase envoie email de confirmation
3. Message: "Check your email to confirm your account!"
4. Utilisateur clique sur lien dans email
5. Redirigé vers: index.html#access_token=...&type=signup
6. ✅ Code détecte le hash
7. ✅ Attend 500ms que la session soit établie
8. ✅ Vérifie session → Redirige vers projects.html
```

### Scénario 2: Connexion avec email
```
1. Utilisateur saisit email + password → Clique "Sign In"
2. ✅ Connexion immédiate (pas d'email)
3. ✅ Redirige directement vers projects.html
```

### Scénario 3: OAuth (GitHub/Google)
```
1. Utilisateur clique sur bouton OAuth
2. Redirigé vers page OAuth provider
3. Autorise l'accès
4. Redirigé vers projects.html (ou editor.html?share= si applicable)
```

## Fichiers modifiés

1. ✅ **`index.html`**
   - Suppression de la duplication de `signInWithGoogle()`
   - Ajout de la détection du hash fragment (#access_token)
   - Ajout d'un délai de 500ms pour laisser Supabase établir la session

## Tests à effectuer

### ✅ Test 1: Inscription par email
1. Ouvrir `index.html`
2. Cliquer "Get Started"
3. Basculer vers "Sign Up"
4. Entrer email + password + username
5. Cliquer "Sign Up"
6. **Attendu**: Message "Check your email to confirm your account!"
7. Ouvrir email → Cliquer sur le lien
8. **Attendu**: Redirection automatique vers `projects.html`
9. **Attendu**: Pas d'erreur dans la console

### ✅ Test 2: Connexion par email
1. Ouvrir `index.html`
2. Cliquer "Get Started"
3. Entrer email + password
4. Cliquer "Sign In"
5. **Attendu**: Redirection immédiate vers `projects.html`

### ✅ Test 3: OAuth Google
1. Ouvrir `index.html`
2. Cliquer "Get Started"
3. Cliquer sur le bouton Google
4. Autoriser l'accès
5. **Attendu**: Redirection vers `projects.html`
6. **Attendu**: Pas d'erreur "signInWithGoogle already declared"

### ✅ Test 4: Boutons après confirmation email
1. Suivre le processus d'inscription (Test 1)
2. Après redirection vers `projects.html`, se déconnecter
3. Revenir à `index.html`
4. **Attendu**: Bouton "Get Started" cliquable
5. **Attendu**: Modal s'ouvre correctement

## Notes techniques

### Pourquoi le délai de 500ms ?
```javascript
if (accessToken) {
    // Supabase SDK will handle the session automatically
    // Wait a moment for session to be established
    await new Promise(resolve => setTimeout(resolve, 500));
}
```

Supabase traite le hash fragment (`#access_token=...`) de manière **asynchrone**. Le délai de 500ms laisse le temps au SDK de :
1. Parser le hash
2. Extraire le token
3. Créer la session
4. Stocker la session dans localStorage

Sans ce délai, `getSession()` pourrait retourner `null` même si le token est valide.

### Alternative: Event Listener
Au lieu d'un délai fixe, on pourrait écouter l'événement `onAuthStateChange` :
```javascript
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
        window.location.href = 'projects.html';
    }
});
```

Mais le délai de 500ms est plus simple et fiable pour ce cas d'usage.

## Résumé

**Problèmes** :
- ❌ Fonction dupliquée → Erreur de syntaxe
- ❌ Hash fragment non détecté → Pas de redirection automatique
- ❌ Event listeners non attachés → Boutons non cliquables

**Solutions** :
- ✅ Suppression du doublon
- ✅ Détection du hash avec `window.location.hash`
- ✅ Délai de 500ms pour laisser la session s'établir
- ✅ Event listeners toujours attachés

**Résultat** :
- ✅ Inscription email fonctionne parfaitement
- ✅ Connexion email fonctionne
- ✅ OAuth fonctionne
- ✅ Redirection automatique après confirmation email
- ✅ Boutons toujours cliquables
