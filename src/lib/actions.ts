import { useStore } from '../store';
import { executeGraphQL, parseDocumentOperations, findOperationAtLine } from './graphql';
import { upsertOperation, loadOperations } from './db';
import type { Operation } from '../store';

export async function runOperation(
  editorContent: string,
  cursorLine: number,
): Promise<void> {
  const {
    endpoint,
    headers,
    variablesContent,
    setResponse,
    setIsExecuting,
    setOperations,
  } = useStore.getState();

  if (!endpoint) {
    setResponse(
      JSON.stringify(
        { error: 'No endpoint configured — open Settings (⌘,) to set one.' },
        null,
        2,
      ),
    );
    return;
  }

  if (!editorContent.trim()) {
    setResponse(
      JSON.stringify({ error: 'Editor is empty — write a GraphQL operation first.' }, null, 2),
    );
    return;
  }

  const operationName = findOperationAtLine(editorContent, cursorLine);

  let variables: unknown = {};
  try {
    variables = JSON.parse(variablesContent || '{}');
  } catch {}

  setIsExecuting(true);
  try {
    const headersMap = Object.fromEntries(headers);
    const result = await executeGraphQL(
      endpoint,
      headersMap,
      editorContent,
      variables,
      operationName,
    );
    setResponse(JSON.stringify(result, null, 2));
  } catch (err) {
    setResponse(JSON.stringify({ error: String(err) }, null, 2));
  } finally {
    setIsExecuting(false);
  }

  // Persist only the operation that was actually run.
  if (operationName) {
    const ops = parseDocumentOperations(editorContent);
    const ran = ops.find((o) => o.name === operationName) as Pick<Operation, 'name' | 'type' | 'body'> | undefined;
    if (ran) {
      await upsertOperation(ran);
      setOperations(await loadOperations());
    }
  }
}
