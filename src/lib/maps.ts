/** The value at `key`, inserting the one `create` builds when the map has none. */
export function getOrCreate<K, V>(map: Map<K, V>, key: K, create: () => V): V {
	let value = map.get(key);
	if (value === undefined) {
		value = create();
		map.set(key, value);
	}
	return value;
}
