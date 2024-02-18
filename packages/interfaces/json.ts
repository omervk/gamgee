export type JSONPrimitive = string | number | boolean | null
export type JSONObject = { [member: string]: JSONValue }
export type JSONValue = JSONPrimitive | JSONObject | Array<JSONValue>
