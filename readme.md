# Express Cache Middleware

Boost the performance of your Express.js web applications with this middleware that simplifies and optimizes caching. Reduce server load, improve response times, and enjoy customizable cache settings, including timeouts and dependency-based cache invalidation

- Provides efficient caching for Express.js routes, reducing server load and response times.
- Supports customizable cache timeouts and callback functions upon cache expiration.
- Offers dependency-based cache invalidation to ensure data consistency.

## Features

- **Efficient Caching:** Improve the performance of your Express.js applications by caching responses.

- **Dependency-Based Invalidation:** You can give a dependency array to invalidate cache whenever any of the dependencies changed.( You created new post, change the dependency, new comment made, change the dependency.)

- **Customizable Timeout:** Set cache expiration times to suit your application's needs.

- **Plug and Play** Simply apply the middleware to your routes for instant caching benefits. It automatically caches your responses and uses it when needed.

**Overview:**

The Express Cache Middleware is a package that enables easy and efficient caching for your small or mid-sized Express.js applications. It enhances the performance of your web server by storing and serving previously generated responses, reducing the load on your server and improving response times. For advanced caching mechanism or big applications, please go for Redis or memcached.

## Install and Usage

You can install the Express Cache Middleware package using npm. Open your terminal or command prompt and run the following command:

```sh
npm install cache-express
```

To use the Express Cache Middleware, simply import it and apply it as middleware to your Express.js routes.

```javascript
import express from "express";
import expressCache from "cache-express";

const app = express();

// Apply the caching middleware to a route
app.get(
	"/api/data",
	expressCache({
		/*options*/
	})
);
```

## Options

The Express Cache Middleware provides several configuration options to tailor caching behavior to your specific needs:

- **`dependsOn` (optional, default: `() => []`)**: A function that returns an array of dependency values for cache checking. When any of these dependencies change, the cache for the associated route will be invalidated and refreshed.

- **`timeOut` (optional, default: `1 hour`)**: Specifies the cache timeout in milliseconds. This determines how long a cached response remains valid before it's considered expired and refreshed. If Dependency array changes, this timing will be resetted.

- **`onTimeout` (optional, default: `() => { console.log("Cache removed"); }`)**: An optional callback function that executes when a cached item expires and is removed from the cache. Use this for custom cache expiration handling.

### Example Usage

```javascript
import express from "express";
import expressCache from "cache-express";

const app = express();

// Apply caching middleware with custom options
app.get(
	"/api/data",
	expressCache({
		dependsOn: () => [getUserID()],
		timeOut: 60000, // Cache for 1 minute
		onTimeout: (key, value) => {
			console.log(`Cache removed for key: ${key}`);
		},
	}),
	(req, res) => {
		// time consuming api or database calls
		let data = { success: true };
		res.json(data);
	}
);

//Or you can create a middleWare configuration beforehand:
let postsCache = expressCache({
	dependsOn: () => [postCount],
	timeOut: 40000,
	onTimeout: () => {
		console.log(`Posts changed, cache removed`);
	},
});

//then use it in route.
app.get("/api/posts", postsCache, (req, res) => {
	//...
	res.send("");
});

app.listen(3000, () => {
	console.log("Server is running on port 3000");
});
```

**Dependency-Based Cache Invalidation:**

The middleware supports dependency-based cache invalidation. You can specify dependencies for your cached data, and the cache will be automatically invalidated if any of the dependencies change. This dependsOn should be **function which returns** an array that includes dependencies.

```javascript
app.get(
	"/api/data",
	expressCache({
		dependsOn: () => [value1, value2],
	})
);
```

**Examples:**

1. Basic Usage:

   ```javascript
   import express from "express";
   import expressCache from "cache-express";

   const app = express();

   app.get("/api/data", expressCache());

   app.listen(3000, () => {
   	console.log("Server is running on port 3000");
   });
   ```

2. Custom Timeout and Callback:

   ```javascript
   app.get(
   	"/api/data",
   	expressCache({
   		timeOut: 60000, // Cache for 1 minute
   		onTimeout: (key, value) => {
   			console.log(`Cache removed for key: ${key}`);
   		},
   	})
   );
   ```

3. Dependency-Based Invalidation:

   ```javascript
   app.get(
   	"/api/user",
   	expressCache({
   		dependsOn: () => [getUserID()],
   	})
   );
   ```

## License

This project is licensed under the [MIT License](LICENSE).
