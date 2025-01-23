import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type SearchClient } from '@azure/search-documents';
import { DynamicTool, type ToolParams } from 'langchain/tools';
import { initializeAgentExecutorWithOptions } from 'langchain/agents';
import { CallbackManager } from 'langchain/callbacks';
import { type OpenAiService } from '../../plugins/openai.js';
import { type LangchainService } from '../../plugins/langchain.js';
import { CsvLookupTool, HtmlCallbackHandler } from '../langchain/index.js';
import {
  type ApproachResponseChunk,
  type ApproachContext,
  type AskApproach,
  type ApproachResponse,
} from './approach.js';
import { ApproachBase } from './approach-base.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEMPLATE_PREFIX = `Du bist ein intelligenter Assistent, der den Wählern der Bundesrepublik Deutschland bei Fragen zu den zur Wahl stehenden Parteien und deren Wahlpgroammen hilfst.
Beantworte die Frage nur mit den Daten, die in den unten stehenden Informationsquellen angegeben sind.
Gebe tabellarische Informationen als html-Tabelle zurück. Gebe kein Markdown-Format an.
Jede Quelle hat einen Namen, gefolgt von einem Doppelpunkt und den eigentlichen Daten; gebe den Namen der Quelle für jeden Teil der Daten an, den du in deiner Antwort verwendest.
Wenn die Frage zum Beispiel lautet „Welche Farbe hat der Himmel?“ und eine der Informationsquellen sagt „info123: Der Himmel ist blau, wenn er nicht bewölkt ist“, dann antworten Sie mit „Der Himmel ist blau [info123]“.
Es ist wichtig, sich strikt an das Format zu halten, bei dem der Name der Quelle in eckigen Klammern am Ende des Satzes steht, und zwar nur bis zum Präfix vor dem Doppelpunkt („:“).
Wenn es mehrere Quellen gibt, zitiere jede einzelne in einer eigenen eckigen Klammer. Verwende zum Beispiel „[info343][ref-76]“ und nicht „[info343,ref-76]“.
Gib niemals den Namen eines Tools als Quelle an.
Wenn du die unten aufgeführten Quellen nicht verwenden kannst, sagen, dass du es nicht weißt.

Du kannst auf die folgenden Tools zugreifen:`;

const TEMPLATE_SUFFIX = `Beginne!

Frage: {input}

Gedanken: {agent_scratchpad}`;

/**
 * Attempt to answer questions by iteratively evaluating the question to see what information is missing,
 * and once all information is present then formulate an answer. Each iteration consists of two parts:
 *   1. use GPT to see if we need more information
 *   2. if more data is needed, use the requested "tool" to retrieve it.
 * The last call to GPT answers the actual question.
 * This is inspired by the MKRL paper[1] and applied here using the implementation in Langchain.
 * [1] E. Karpas, et al. arXiv:2205.00445
 */
export class AskReadRetrieveRead extends ApproachBase implements AskApproach {
  constructor(
    private langchain: LangchainService,
    search: SearchClient<any>,
    openai: OpenAiService,
    chatGptModel: string,
    embeddingModel: string,
    sourcePageField: string,
    contentField: string,
  ) {
    super(search, openai, chatGptModel, embeddingModel, sourcePageField, contentField);
  }

  async run(userQuery: string, context?: ApproachContext): Promise<ApproachResponse> {
    let searchResults: string[] = [];

    const htmlTracer = new HtmlCallbackHandler();
    const callbackManager = new CallbackManager();
    callbackManager.addHandler(htmlTracer);

    const searchAndStore = async (query: string): Promise<string> => {
      const { results, content } = await this.searchDocuments(query, context);
      searchResults = results;
      return content;
    };

    const tools = [
      new DynamicTool({
        name: 'CognitiveSearch',
        func: searchAndStore,
        description: 'nützlich für die Suche nach parteibezogenen Dokumenten wie Wahlprogramme',
        callbacks: callbackManager,
      }),
      new EmployeeInfoTool('Employee1', { callbacks: callbackManager }),
    ];

    const chatModel = await this.langchain.getChat({
      temperature: Number(context?.temperature) || 0.3,
    });

    const executor = await initializeAgentExecutorWithOptions(tools, chatModel, {
      agentType: 'chat-zero-shot-react-description',
      agentArgs: {
        prefix: context?.prompt_template_prefix || TEMPLATE_PREFIX,
        suffix: context?.prompt_template_suffix || TEMPLATE_SUFFIX,
        inputVariables: ['input', 'agent_scratchpad'],
      },
      returnIntermediateSteps: true,
      callbackManager,
      verbose: true,
    });

    const result = await executor.call({ input: userQuery });

    // Remove references to tool names that might be confused with a citation
    const answer = result.output.replace('[CognitiveSearch]', '').replace('[Employee]', '');

    return {
      choices: [
        {
          index: 0,
          message: {
            content: answer,
            role: 'assistant' as const,
            context: {
              data_points: {
                text: searchResults,
              },
              thoughts: htmlTracer.getAndResetLog(),
            },
          },
        },
      ],
      object: 'chat.completion',
    };
  }

  // eslint-disable-next-line require-yield
  async *runWithStreaming(_query: string, _context?: ApproachContext): AsyncGenerator<ApproachResponseChunk, void> {
    throw new Error('Streaming not supported for this approach.');
  }
}

class EmployeeInfoTool extends CsvLookupTool {
  static lc_name(): string {
    return 'EmployeeInfoTool';
  }

  name = 'Employee';
  description =
    'nützlich für die Suche nach Details anhand eines Eingabeschlüssels, im Gegensatz zur Suche nach Daten mit einer unstrukturierten Frage';

  constructor(
    private employeeName: string,
    options?: ToolParams,
  ) {
    super(path.join(__dirname, '../../../data/employee-info.csv'), 'name', options);
  }

  async _call(input: string): Promise<string> {
    await this.loadFile();
    input = input?.trim();

    // Only managers can access other employees' information
    const isManager = this.lookup(this.employeeName).title?.toLowerCase().includes('manager');
    return isManager || input?.toLowerCase() === this.employeeName.toLowerCase()
      ? this.lookupAsString(input)
      : 'I am not allowed to share that information with you.';
  }
}
