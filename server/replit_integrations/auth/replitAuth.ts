import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";
import * as client from "openid-client";

let oidcConfig: client.Configuration | null = null;

async function getOidcConfig(): Promise<client.Configuration | null> {
  if (oidcConfig) return oidcConfig;
  
  const issuerUrl = process.env.ISSUER_URL || process.env.REPLIT_DEPLOYMENT_URL 
    ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
    : null;
  
  if (!issuerUrl) {
    // Fallback to Google OAuth if no Replit OIDC
    return null;
  }
  
  try {
    oidcConfig = await client.discovery(
      new URL(issuerUrl),
      process.env.REPL_ID!,
      process.env.REPLIT_OIDC_CLIENT_SECRET
    );
    return oidcConfig;
  } catch {
    return null;
  }
}

export function getSession() {
  const sessionTtl = 30 * 24 * 60 * 60 * 1000; // 30 days
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await authStorage.getUser(id);
      done(null, user || null);
    } catch (error) {
      done(error);
    }
  });

  // Login route
  app.get("/api/login", async (req, res) => {
    const config = await getOidcConfig();
    
    if (!config) {
      return res.status(500).json({ message: "Authentication not configured" });
    }

    const callbackUrl = `${req.protocol}://${req.get("host")}/api/callback`;
    const nonce = client.randomNonce();
    const state = client.randomState();
    
    (req.session as any).oidcNonce = nonce;
    (req.session as any).oidcState = state;

    const authUrl = client.buildAuthorizationUrl(config, {
      redirect_uri: callbackUrl,
      scope: "openid email profile",
      nonce,
      state,
    });

    res.redirect(authUrl.href);
  });

  // Callback route
  app.get("/api/callback", async (req, res) => {
    try {
      const config = await getOidcConfig();
      if (!config) {
        return res.redirect("/?error=auth_not_configured");
      }

      const callbackUrl = `${req.protocol}://${req.get("host")}/api/callback`;
      const nonce = (req.session as any).oidcNonce;
      const state = (req.session as any).oidcState;

      const tokens = await client.authorizationCodeGrant(config, new URL(req.url, callbackUrl), {
        expectedNonce: nonce,
        expectedState: state,
      });

      const claims = tokens.claims();
      if (!claims) {
        return res.redirect("/?error=no_claims");
      }

      const user = await authStorage.upsertUser({
        id: claims.sub,
        email: (claims as any).email || null,
        firstName: (claims as any).first_name || (claims as any).given_name || null,
        lastName: (claims as any).last_name || (claims as any).family_name || null,
        profileImageUrl: (claims as any).profile_image_url || (claims as any).picture || null,
      });

      req.login(user, (err) => {
        if (err) {
          console.error("Login error:", err);
          return res.redirect("/?error=login_failed");
        }
        res.redirect("/");
      });
    } catch (error) {
      console.error("Callback error:", error);
      res.redirect("/?error=callback_failed");
    }
  });

  // Logout route
  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect("/");
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};
