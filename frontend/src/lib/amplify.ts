import { Amplify } from "aws-amplify";

let configured = false;

export function ensureAmplifyConfigured() {
  if (configured) return;
  if (typeof window === "undefined") return;

  const region = process.env.NEXT_PUBLIC_COGNITO_REGION;
  const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

  if (!region || !userPoolId || !userPoolClientId) {
    throw new Error(
      "Missing Cognito env vars. Set NEXT_PUBLIC_COGNITO_REGION, NEXT_PUBLIC_COGNITO_USER_POOL_ID, NEXT_PUBLIC_COGNITO_CLIENT_ID.",
    );
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
      },
    },
  });

  configured = true;
}

