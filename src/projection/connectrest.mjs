// ConnectREST: the endpoint and, per HTTP method, headers and data mapped in and out.
// Fields read on the fixture: pyEmbeddedURL, pyUseAuthentication, pyResponseTimeout, pyHandlerFlow,
// py<METHOD>Request|Response{Headers,Parameters,DataList} (docs/projection.md).
import { filled, items, references } from './common.mjs';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

// A parameter row is empty when it holds no name: the server fills each list with a blank entry.
const named = (list) => items(list).filter((p) => filled(p.pyParameterName));

function mapping(p) {
  if (filled(p.pyMapFromKey)) return `${p.pyParameterName}=${p.pyMapFromKey}`;
  if (filled(p.pyMapToKey)) return `${p.pyParameterName}→${p.pyMapToKey}`;
  return p.pyParameterName;
}

export function body(o) {
  const refs = references();
  const cls = o.pyClassName;
  const lines = [];
  const url = o.pyEmbeddedURL;
  if (filled(url?.pyEndpointURL)) lines.push('', `endpoint: ${url.pyEndpointURL}`);
  const path = named(url?.pyResourcePathParameters).map((p) => p.pyParameterName);
  if (path.length) lines.push(`path: ${path.join('/')}`);
  const settings = [];
  if (filled(o.pyResponseTimeout)) settings.push(`timeout ${o.pyResponseTimeout} ms`);
  if (o.pyUseAuthentication === 'true') settings.push(`authentication ${o.pyAuthProfileSelectionType ?? ''}`.trim());
  if (o.pyUseProxy === 'true') settings.push('proxy');
  if (filled(o.pyHandlerFlow)) settings.push(`on failure: flow ${o.pyHandlerFlow}`);
  if (settings.length) lines.push(settings.join(', '));
  for (const method of METHODS) {
    const parts = [];
    for (const [label, key] of [['request headers', 'RequestHeaders'], ['request parameters', 'RequestParameters'], ['request data', 'RequestDataList'], ['response headers', 'ResponseHeaders'], ['response data', 'ResponseDataList']]) {
      const list = named(o[`py${method}${key}`]);
      if (list.length) parts.push(`${label} ${list.map(mapping).join(', ')}`);
      if (key === 'ResponseDataList') for (const p of list) refs.property(cls, p.pyMapToKey, 'response mapping');
    }
    if (parts.length) lines.push('', `### ${method}`, ...parts.map((p) => `- ${p}`));
  }
  return { lines, references: refs.all() };
}
