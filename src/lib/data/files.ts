const g = globalThis as unknown as {
  __splittabFiles?: Map<string, { buf: Buffer; type: string }>;
};

function files() {
  if (!g.__splittabFiles) g.__splittabFiles = new Map();
  return g.__splittabFiles;
}

export function putFile(path: string, buf: Buffer, type: string) {
  files().set(path, { buf, type });
}

export function getFile(path: string) {
  return files().get(path) ?? null;
}
