// ============================================================
// Store i18n — FR / EN
// Usage : import { t, setLocale, getLocale } from '$lib/i18n.svelte'
// ============================================================

type Locale = 'fr' | 'en';

const dict = {
  fr: {
    // Nav
    'nav.exercises':  'Exercices',
    'nav.circuits':   'Circuits',
    'nav.session':    'Session',
    'nav.history':    'Historique',
    'nav.stats':      'Stats',
    'nav.calendar':   'Calendrier',
    'nav.screens':    'Écrans',
    'nav.tvStation':   'TV Station',
    'nav.tvCentral':   'TV Centrale',
    'nav.tvSchedule':  'TV Calendrier',
    'nav.users':       'Utilisateurs',
    'nav.settings':   'Paramètres',
    // User menu
    'user.changePassword': 'Changer le mot de passe',
    'user.manageUsers':    'Gérer les utilisateurs',
    'user.switchUser':     "Changer d'utilisateur",
    'user.logout':         'Déconnexion',
    // Auth
    'auth.login.title':       'Connexion',
    'auth.login.email':       'Adresse courriel',
    'auth.login.password':    'Mot de passe',
    'auth.login.submit':      'Se connecter',
    'auth.login.loading':     'Connexion…',
    'auth.login.subtitle':    "Console d'administration",
    // Setup
    'setup.title':    'Première configuration',
    'setup.subtitle': 'Aucun compte détecté',
    'setup.desc':     'Créez votre premier compte administrateur pour accéder à la console.',
    'setup.submit':   'Créer le compte administrateur',
    'setup.loading':  'Création…',
    // Change password
    'pw.current':  'Mot de passe actuel',
    'pw.new':      'Nouveau mot de passe',
    'pw.confirm':  'Confirmer le nouveau mot de passe',
    'pw.submit':   'Changer le mot de passe',
    'pw.loading':  'Enregistrement…',
    'pw.mismatch': 'Les mots de passe ne correspondent pas',
    'pw.rule.length':  'Minimum 8 caractères',
    'pw.rule.upper':   'Au moins une majuscule',
    'pw.rule.lower':   'Au moins une minuscule',
    'pw.rule.digit':   'Au moins un chiffre',
    'pw.rule.special': 'Au moins un caractère spécial',
    // Common
    'common.cancel': 'Annuler',
    'common.save':   'Enregistrer',
    'common.delete': 'Supprimer',
    'common.create': 'Créer',
    'common.edit':   'Modifier',
    'common.admin':  'Admin',
    'common.coach':  'Coach',
    'common.role':   'Rôle',
    // Settings page
    'settings.title':        'Paramètres studio',
    'settings.studioName':   'Nom du studio',
    'settings.primaryColor': 'Couleur principale',
    'settings.logo':         'Logo',
    'settings.logoUpload':   'Téléverser un logo',
    'settings.save':         'Enregistrer',
    'settings.saved':        'Paramètres enregistrés',
  },
  en: {
    // Nav
    'nav.exercises':  'Exercises',
    'nav.circuits':   'Circuits',
    'nav.session':    'Session',
    'nav.history':    'History',
    'nav.stats':      'Stats',
    'nav.calendar':   'Schedule',
    'nav.screens':    'Screens',
    'nav.tvStation':   'TV Station',
    'nav.tvCentral':   'TV Central',
    'nav.tvSchedule':  'TV Schedule',
    'nav.users':       'Users',
    'nav.settings':   'Settings',
    // User menu
    'user.changePassword': 'Change password',
    'user.manageUsers':    'Manage users',
    'user.switchUser':     'Switch user',
    'user.logout':         'Sign out',
    // Auth
    'auth.login.title':       'Sign in',
    'auth.login.email':       'Email address',
    'auth.login.password':    'Password',
    'auth.login.submit':      'Sign in',
    'auth.login.loading':     'Signing in…',
    'auth.login.subtitle':    'Administration console',
    // Setup
    'setup.title':    'Initial setup',
    'setup.subtitle': 'No account found',
    'setup.desc':     'Create your first administrator account to access the console.',
    'setup.submit':   'Create administrator account',
    'setup.loading':  'Creating…',
    // Change password
    'pw.current':  'Current password',
    'pw.new':      'New password',
    'pw.confirm':  'Confirm new password',
    'pw.submit':   'Change password',
    'pw.loading':  'Saving…',
    'pw.mismatch': 'Passwords do not match',
    'pw.rule.length':  'Minimum 8 characters',
    'pw.rule.upper':   'At least one uppercase letter',
    'pw.rule.lower':   'At least one lowercase letter',
    'pw.rule.digit':   'At least one digit',
    'pw.rule.special': 'At least one special character',
    // Common
    'common.cancel': 'Cancel',
    'common.save':   'Save',
    'common.delete': 'Delete',
    'common.create': 'Create',
    'common.edit':   'Edit',
    'common.admin':  'Admin',
    'common.coach':  'Coach',
    'common.role':   'Role',
    // Settings
    'settings.title':        'Studio settings',
    'settings.studioName':   'Studio name',
    'settings.primaryColor': 'Primary color',
    'settings.logo':         'Logo',
    'settings.logoUpload':   'Upload logo',
    'settings.save':         'Save',
    'settings.saved':        'Settings saved',
  },
} satisfies Record<Locale, Record<string, string>>;

type Key = keyof typeof dict.fr;

const stored = typeof localStorage !== 'undefined'
  ? (localStorage.getItem('cfitv_locale') as Locale | null)
  : null;

let locale = $state<Locale>(stored ?? 'fr');

export function t(key: Key): string {
  return dict[locale][key] ?? dict.fr[key] ?? key;
}

export function setLocale(l: Locale): void {
  locale = l;
  if (typeof localStorage !== 'undefined') localStorage.setItem('cfitv_locale', l);
}

export function getLocale(): Locale { return locale; }
