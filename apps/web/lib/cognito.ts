"use client";

import {
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  DeleteUserCommand,
  ForgotPasswordCommand,
  GlobalSignOutCommand,
  InitiateAuthCommand,
  SignUpCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const region = process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1";
const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID;

const cognitoClient = new CognitoIdentityProviderClient({ region });

export type CognitoSession = {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
};

export function isCognitoConfigured() {
  return Boolean(userPoolClientId);
}

export async function signUpWithCognito({
  username,
  email,
  password,
}: {
  username: string;
  email: string;
  password: string;
}) {
  ensureCognitoConfigured();

  await cognitoClient.send(
    new SignUpCommand({
      ClientId: userPoolClientId,
      Username: username,
      Password: password,
      UserAttributes: [{ Name: "email", Value: email }],
    })
  );
}

export async function confirmSignUpWithCognito({
  username,
  code,
}: {
  username: string;
  code: string;
}) {
  ensureCognitoConfigured();

  await cognitoClient.send(
    new ConfirmSignUpCommand({
      ClientId: userPoolClientId,
      Username: username,
      ConfirmationCode: code,
    })
  );
}

export async function signInWithCognito({
  username,
  password,
}: {
  username: string;
  password: string;
}) {
  ensureCognitoConfigured();

  const result = await cognitoClient.send(
    new InitiateAuthCommand({
      ClientId: userPoolClientId,
      AuthFlow: "USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    })
  );

  const authentication = result.AuthenticationResult;
  if (!authentication?.AccessToken) {
    throw new Error("Cognito did not return a valid session.");
  }

  return {
    accessToken: authentication.AccessToken,
    idToken: authentication.IdToken,
    refreshToken: authentication.RefreshToken,
  };
}

export async function forgotPasswordWithCognito(username: string) {
  ensureCognitoConfigured();

  await cognitoClient.send(
    new ForgotPasswordCommand({
      ClientId: userPoolClientId,
      Username: username,
    })
  );
}

export async function confirmForgotPasswordWithCognito({
  username,
  code,
  newPassword,
}: {
  username: string;
  code: string;
  newPassword: string;
}) {
  ensureCognitoConfigured();

  await cognitoClient.send(
    new ConfirmForgotPasswordCommand({
      ClientId: userPoolClientId,
      Username: username,
      ConfirmationCode: code,
      Password: newPassword,
    })
  );
}

export async function signOutWithCognito(accessToken?: string) {
  if (!accessToken) return;

  await cognitoClient.send(
    new GlobalSignOutCommand({
      AccessToken: accessToken,
    })
  );
}

export async function deleteCognitoUser(accessToken?: string) {
  if (!accessToken) {
    throw new Error("You need to sign in again before deleting this account.");
  }

  await cognitoClient.send(
    new DeleteUserCommand({
      AccessToken: accessToken,
    })
  );
}

function ensureCognitoConfigured() {
  if (!userPoolClientId) {
    throw new Error("Cognito is not configured for this deployment.");
  }
}
