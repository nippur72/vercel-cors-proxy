export default async function handler(req, res) {
  const origin = req.headers.origin;

  // Helper function to check if origin is nippur72.github.io or localhost
  function isOriginAllowed(origin) {
    if (!origin) return false;
    
    // Allow nippur72.github.io and its subdomains
    if (origin === 'https://nippur72.github.io' || origin.endsWith('.nippur72.github.io')) {
      return true;
    }
    
    // Allow localhost and loopback for local testing
    try {
      const parsedOrigin = new URL(origin);
      if (parsedOrigin.hostname === 'localhost' || parsedOrigin.hostname === '127.0.0.1') {
        return true;
      }
    } catch (e) {
      // Ignore URL parsing errors for origin
    }
    
    return false;
  }

  // Determine allowed origin (defaulting to https://nippur72.github.io for safety)
  const allowedOrigin = isOriginAllowed(origin) ? origin : 'https://nippur72.github.io';

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).send('Error: Method Not Allowed. Only GET and OPTIONS are supported.');
    return;
  }

  let targetUrl = req.query.url;

  // Fallback: Reconstruct target URL in case query parameters weren't URL-encoded
  if (req.url && (req.url.includes('?url=') || req.url.includes('&url='))) {
    const parts = req.url.split(/[?&]url=/);
    if (parts.length > 1) {
      const rawTarget = parts[1];
      try {
        const decoded = decodeURIComponent(rawTarget);
        if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
          targetUrl = decoded;
        }
      } catch (e) {
        // Fallback to parsed req.query.url if decode fails
      }
    }
  }

  // If no URL is provided, display simple text usage info
  if (!targetUrl) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(200).send('CORS Proxy. Usage: ?url=https://example.com/file');
    return;
  }

  // Validate the URL format and protocol
  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (e) {
    res.status(400).send('Error: Invalid URL format.');
    return;
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    res.status(400).send('Error: Only http and https protocols are supported.');
    return;
  }

  // Perform the proxy request
  try {
    const fetchResponse = await fetch(parsedUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 RetroProxy/1.0',
        'Accept': req.headers.accept || '*/*'
      }
    });

    if (!fetchResponse.ok) {
      res.status(fetchResponse.status).send(`Error: Target server returned status ${fetchResponse.status} ${fetchResponse.statusText}`);
      return;
    }

    // Set response headers
    const contentType = fetchResponse.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);

    const contentLength = fetchResponse.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    // Read the remote content as arrayBuffer and send as Buffer
    const arrayBuffer = await fetchResponse.arrayBuffer();
    res.status(200).send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('Proxy request failed:', error);
    res.status(502).send(`Error: Failed to fetch the target URL. Details: ${error.message}`);
  }
}
