/**
 * Hashes a string to create a unique cache key.
 * @param {string} str - The input string to be hashed.
 * @returns {number} - The generated hash value.
 */
function hashString(str) {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const charCode = str.charCodeAt(i);
		hash = ((hash << 5) - hash + charCode) | 0;
	}
	return hash + 2147483647 + 1;
}

/**
 * MemoryCache class for caching data in memory.
 */
class MemoryCache {
	constructor() {
		this.cache = {};
		this.dependencies = {};
	}

	/**
	 * Retrieves a value from the cache.
	 * @param {string} key - The cache key.
	 * @param {Array} depArrayValues - Dependency values for cache checking.
	 * @returns {*} - The cached value if found and not expired, otherwise null.
	 */
	get(key, depArrayValues) {
		const item = this.cache[key];
		const checkDepsChanged = this.dependenciesChanged(key, depArrayValues);

		if (checkDepsChanged) {
			if (item && item.timer) {
				clearInterval(item.timer);
			}
			delete this.cache[key];
			return null;
		}

		if (item && (!item.expireTime || item.expireTime > Date.now())) {
			return item.value;
		} else {
			delete this.cache[key];
			return null;
		}
	}

	/**
	 * Sets a value in the cache with an optional timeout and callback.
	 * @param {string} key - The cache key.
	 * @param {*} value - The value to cache.
	 * @param {number} timeoutMs - Timeout in milliseconds.
	 * @param {function} callback - Callback function when the cache expires.
	 * @param {Array} dependencies - Dependency values for cache checking.
	 */
	set(key, value, timeoutMs, callback, dependencies) {
		if (timeoutMs && timeoutMs > 0) {
			const expireTime = Date.now() + timeoutMs;
			this.cache[key] = { value, expireTime, dependencies, timeoutMs };

			if (callback) {
				this.cache[key].timer = setTimeout(() => {
					if (this.cache[key]) {
						callback(key, this.cache[key].value);
						delete this.cache[key];
					}
				}, timeoutMs);
			}
		} else {
			this.cache[key] = { value, dependencies };
		}

		this.dependencies[key] = dependencies;
	}

	/**
	 * Removes a value from the cache.
	 * @param {string} key - The cache key to remove.
	 */
	remove(key) {
		delete this.cache[key];
		delete this.dependencies[key];
	}

	/**
	 * Checks if a key exists in the cache.
	 * @param {string} key - The cache key to check.
	 * @returns {boolean} - True if the key exists in the cache, otherwise false.
	 */
	has(key) {
		return key in this.cache;
	}

	/**
	 * Checks if the dependencies have changed.
	 * @param {string} key - The cache key.
	 * @param {Array} depArrayValues - Dependency values to compare.
	 * @returns {boolean} - True if the dependencies have changed, otherwise false.
	 */
	dependenciesChanged(key, depArrayValues) {
		const dependencies = this.dependencies[key];

		if (!dependencies) {
			return false;
		}

		const check =
			JSON.stringify(dependencies) === JSON.stringify(depArrayValues);

		if (check) {
			return false;
		} else {
			this.dependencies[key] = depArrayValues;
			return true;
		}
	}
}

const cache = new MemoryCache();

/**
 * Middleware function for Express.js to enable caching.
 *
 * @param {Object} [opts] - Options for caching.
 * @param {Function} [opts.dependsOn=() => []] - A function that returns an array of dependency values for cache checking.
 * @param {number} [opts.timeOut=3600000] - Timeout in milliseconds for cache expiration. Default is 1 hour (3600000 ms).
 * @param {Function} [opts.onTimeout=() => { console.log("Cache removed"); }] - A callback function to execute when a cached item expires.
 * @returns {function} - Middleware function.
 */
function expressCache(opts = {}) {
	const defaults = {
		dependsOn: () => [],
		timeOut: 60 * 60 * 1000,
		onTimeout: () => {
			console.log("Cache removed");
		},
	};

	const options = {
		...defaults,
		...opts,
	};

	const { dependsOn, timeOut, onTimeout } = options;

	return function (req, res, next) {
		const cacheKey = "c_" + hashString(req.originalUrl || req.url);
		const depArrayValues = dependsOn();

		const cachedResponse = cache.get(cacheKey, depArrayValues);

		if (cachedResponse) {
			if (typeof cachedResponse === "string") {
				try {
					const jsonData = JSON.parse(cachedResponse);
					res.json(jsonData);
				} catch (error) {
					res.send(cachedResponse);
				}
			} else {
				res.send(cachedResponse);
			}
		} else {
			const originalSend = res.send;
			const originalJson = res.json;

			res.send = function (body) {
				cache.set(
					cacheKey,
					typeof body === "object" ? JSON.stringify(body) : body,
					timeOut,
					onTimeout,
					depArrayValues
				);
				originalSend.call(this, body);
			};

			res.json = function (body) {
				cache.set(cacheKey, body, timeOut, onTimeout, depArrayValues);
				originalJson.call(this, body);
			};

			next();
		}
	};
}
module.exports = expressCache;
module.exports.hash = hashString;
module.exports.MemoryCache = MemoryCache;
