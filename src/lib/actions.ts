import { useStore } from '../store';
import { executeGraphQL, parseDocumentOperations, findOperationAtLine } from './graphql';
import { upsertOperation, loadOperations } from './db';

export async function runOperation(
  editorContent: string,
  cursorLine: number,
): Promise<void> {
  const {
    endpoint,
    headers,
    cookies,
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
  const ops = parseDocumentOperations(editorContent);
  const currentOp = operationName ? ops.find((o) => o.name === operationName) : undefined;
  const queryToSend = currentOp?.body ?? editorContent;

  let variables: unknown = {};
  try {
    variables = JSON.parse(variablesContent || '{}');
  } catch {
    useStore.getState().addToast('Variables contain invalid JSON — sending request with no variables.');
  }

  setIsExecuting(true);
  try {
    const headersMap = Object.fromEntries(headers);
    const cookiesMap = Object.fromEntries(cookies);
    const result = await executeGraphQL(
      endpoint,
      headersMap,
      cookiesMap,
      queryToSend,
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
  if (currentOp) {
    try {
      await upsertOperation(currentOp);
      setOperations(await loadOperations());
    } catch (err) {
      useStore.getState().addToast(`Failed to save operation "${currentOp.name}": ${String(err)}`);
    }
  }
}
