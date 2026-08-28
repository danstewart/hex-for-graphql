import { useStore } from '../store';
import { executeGraphQL, getGraphQLErrorDetails, parseDocumentOperations, findOperationAtLine } from './graphql';
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
    setOperations,
    startExecution,
    completeExecution,
  } = useStore.getState();
  const executionId = startExecution();

  if (!endpoint) {
    completeExecution(
      executionId,
      JSON.stringify(
        { error: 'No endpoint configured — open Settings (⌘,) to set one.' },
        null,
        2,
      ),
    );
    return;
  }

  if (!editorContent.trim()) {
    completeExecution(
      executionId,
      JSON.stringify({ error: 'Editor is empty — write a GraphQL operation first.' }, null, 2),
    );
    return;
  }

  let operationName: string | null;
  let currentOp;
  try {
    operationName = findOperationAtLine(editorContent, cursorLine);
    const ops = parseDocumentOperations(editorContent);
    currentOp = operationName ? ops.find((o) => o.name === operationName) : undefined;
  } catch (err) {
    completeExecution(executionId, JSON.stringify({ error: String(err) }, null, 2));
    return;
  }
  const queryToSend = currentOp?.body ?? editorContent;

  let variables: unknown = null;
  try {
    variables = JSON.parse(variablesContent || '{}');
  } catch {
    useStore.getState().addToast('Variables contain invalid JSON — sending request without variables.');
  }

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
    completeExecution(executionId, JSON.stringify(result, null, 2));
  } catch (err) {
    const { detail, responseBody } = getGraphQLErrorDetails(err);
    completeExecution(
      executionId,
      responseBody ?? JSON.stringify({ error: detail }, null, 2),
    );
  }

  // Persist only the operation that was actually run and is still current.
  if (currentOp && useStore.getState().executionId === executionId) {
    try {
      await upsertOperation(currentOp);
      const operations = await loadOperations();
      if (useStore.getState().executionId === executionId) {
        setOperations(operations);
      }
    } catch (err) {
      useStore.getState().addToast(`Failed to save operation "${currentOp.name}": ${String(err)}`);
    }
  }
}
