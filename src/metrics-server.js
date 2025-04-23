import http from 'http';
import { register, collectDefaultMetrics } from 'prom-client';
import url from 'url';

export const startMetricsServer = async (host, options = {}) => {

  // Create an HTTP server to expose metrics
  const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;

    // Add method check
    const method = req.method;

    if (pathname === '/metrics') {
      res.setHeader('Content-Type', register.contentType);
      res.end(await register.metrics());
    } else if (pathname === '/database' && method === 'DELETE') {
      // Check if REST delete is allowed
      if (!options.allowRestDelete) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'REST API deletion is disabled. Enable with --allow-rest-delete' }));
        return;
      }

      // Handle database deletion
      if (!host) {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Host not available' }));
        return;
      }

      const address = query.address;
      if (!address) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Database address is required' }));
        return;
      }

      try {
        const dbInstance = await host.orbitdb.open(address);
        await dbInstance.drop();
        await host.databases.del(address);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ message: `Database ${address} successfully deleted` }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: error.message }));
      }
    } else if (pathname === '/pinned-databases') {
      // Endpunkt für gepinnte Datenbanken
      if (!host) {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Host not available' }));
        return;
      }

      try {
        // Alle Datenbanken aus dem Host abrufen
        const pinnedDatabases = [];
        
        // Über alle Datenbanken iterieren und Metadaten sammeln
        for await (const db of host.databases.iterator()) {
          const dbInstance = await host.orbitdb.open(db.key);
          
          // Metadaten sammeln
          const metadata = {
            address: db.key,
            name: dbInstance.address.path,
            type: dbInstance.type,
            accessController: dbInstance.access.type,
            entries: await dbInstance.all(),
            // Weitere Metadaten können hier hinzugefügt werden
          };
          
          pinnedDatabases.push(metadata);
        }

        // Als JSON zurückgeben
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(pinnedDatabases, null, 2));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: error.message }));
      }
    } else if (pathname === '/database-history') {
      // Endpunkt für die Datenbankhistorie
      if (!host) {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Host not available' }));
        return;
      }

      // Adresse aus der Abfrage abrufen
      const address = query.address;
      if (!address) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Database address is required' }));
        return;
      }

      try {
        // Datenbank öffnen
        const dbInstance = await host.orbitdb.open(address);
        
        // Log-Einträge abrufen
        const history = [];
        for await (const entry of dbInstance.log.iterator({ reverse: true })) {
          history.push({
            hash: entry.hash,
            id: entry.id,
            payload: entry.payload,
            identity: entry.identity,
            timestamp: entry.timestamp,
            next: entry.next,
            v: entry.v
          });
        }

        // Metadaten und Historie zusammenfassen
        const result = {
          address: dbInstance.address.toString(),
          name: dbInstance.address.path,
          type: dbInstance.type,
          accessController: dbInstance.access.type,
          history: history
        };

        // Als JSON zurückgeben
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result, null, 2));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: error.message }));
      }
    } else {
      res.statusCode = 404;
      res.end('Not found');
    }
  });

  // Start the server
  const port = options.metricsPort || 9090;
  server.listen(port, () => {
    console.log(`Metrics server running at http://localhost:${port}/metrics`);
    console.log(`Pinned databases available at http://localhost:${port}/pinned-databases`);
    console.log(`Database history available at http://localhost:${port}/database-history?address=<db-address>`);
    console.log(`Delete database available at http://localhost:${port}/database?address=<db-address> (DELETE method)`);
  });

  return server;
};