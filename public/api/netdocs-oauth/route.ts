import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: req.headers.get('authorization') ?? '' } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, externalDatabaseId, code, state } = await req.json();

    if (action === 'authorize') {
      const clientId = process.env.NETDOCS_CLIENT_ID;
      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/netdocs-oauth`;

      if (!clientId) {
        return NextResponse.json({ error: 'NetDocs OAuth not configured' }, { status: 500 });
      }

      const authUrl = new URL('https://api.netdocuments.com/v1/oauth/authorize');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('scope', 'read write');
      authUrl.searchParams.set('state', externalDatabaseId);

      return NextResponse.json({
        authorizationUrl: authUrl.toString()
      });
    }

    if (action === 'callback') {
      if (!code || !state) {
        return NextResponse.json({ error: 'Missing authorization code or state' }, { status: 400 });
      }

      const clientId = process.env.NETDOCS_CLIENT_ID;
      const clientSecret = process.env.NETDOCS_CLIENT_SECRET;
      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/netdocs-oauth`;

      // Exchange code for tokens
      const tokenResponse = await fetch('https://api.netdocuments.com/v1/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId!,
          client_secret: clientSecret!,
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        console.error('Token exchange failed:', error);
        return NextResponse.json({ error: 'Failed to exchange authorization code' }, { status: 400 });
      }

      const tokenData = await tokenResponse.json();
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

      // Update the external database with tokens
      const { error: updateError } = await supabase
        .from('external_databases')
        .update({
          oauth_access_token: tokenData.access_token,
          oauth_refresh_token: tokenData.refresh_token,
          oauth_expires_at: expiresAt.toISOString(),
          status: 'connected',
        })
        .eq('id', state);

      if (updateError) {
        console.error('Failed to update database:', updateError);
        return NextResponse.json({ error: 'Failed to save OAuth tokens' }, { status: 500 });
      }

      // Fetch user info from NetDocs
      try {
        const userResponse = await fetch('https://api.netdocuments.com/v1/user', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
          },
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          console.log('NetDocs user authenticated:', userData.email);
        }
      } catch (error) {
        console.error('Failed to fetch user info:', error);
      }

      return NextResponse.json({
        success: true,
        message: 'NetDocs OAuth completed successfully',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error in netdocs-oauth function:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Handle OAuth callback
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?error=${encodeURIComponent(error)}`);
  }

  if (code && state) {
    // Process the callback
    const callbackResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/netdocs-oauth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'callback',
        code,
        state,
      }),
    });

    if (callbackResponse.ok) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?oauth=success`);
    } else {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?oauth=error`);
    }
  }

  return NextResponse.json({ error: 'Invalid callback' }, { status: 400 });
}