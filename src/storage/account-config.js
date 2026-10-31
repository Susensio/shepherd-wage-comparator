/** The Supabase project. With `null` every account feature is off and the page never touches the network. */
export const ACCOUNT_CONFIG = {
  url: /** @type {string | null} */ ('https://etvrgexvjviavulflcqr.supabase.co'),
  // Publishable key: public by design, the policies in supabase/migrations/ are what protect the data.
  anonKey: /** @type {string | null} */ ('sb_publishable_p0ULnoEaShHV-S2RbSdg1Q_hkx1zz0W'),
  /** The OAuth client whose ID and secret are in Supabase's Google provider; Google's button needs it too. */
  googleClientId: /** @type {string | null} */ (
    '450124346231-ucnms27iq4968g4la1fv5qbcgb9r0vig.apps.googleusercontent.com'
  ),
  /**
   * Signing in with an emailed code (ADR-0009). Off until Supabase has a custom SMTP sender: its built-in one reaches
   * only the project's team, and its email templates, which must carry `{{ .Token }}`, cannot be changed.
   */
  emailSignIn: false,
};
