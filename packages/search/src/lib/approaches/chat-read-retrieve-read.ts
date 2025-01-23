import { type SearchClient } from '@azure/search-documents';
import { type OpenAiService } from '../../plugins/openai.js';
import {
  type ChatApproach,
  type ApproachResponse,
  type ChatApproachContext,
  type ApproachResponseChunk,
} from './approach.js';
import { ApproachBase } from './approach-base.js';
import { type Message, messagesToString } from '../message.js';
import { MessageBuilder } from '../message-builder.js';
import { getTokenLimit } from '../tokens.js';

const SYSTEM_MESSAGE_CHAT_CONVERSATION = `Du bist ein politisch neutraler Assistent, der thematische Fragen über Parteien beantwortet, anhand deren Wahlprogramm. Du bist sachlich und faktenorientiert.

Wenn eine Frage gestellt wird, die parteiübergreifend ist, dann berücksichtige jede Partei (CDU/CSU, SPD, Grüne, FDP, AfD, BSW, Linke), die einen Standpunkt zu dem Thema hat.
Bei Fragen zu einer bestimmten Partei berücksichtige NUR deren Wahlprogramm.

# Antwortschema für allgemein/parteiübergreifenden Fragen
CDU/CSU:
{Standpunkt der Partei, wenn vorhanden}
AfD:
{Standpunkt der Partei, wenn vorhanden}
SPD:
{Standpunkt der Partei, wenn vorhanden}
Die Grünen:
{Standpunkt der Partei, wenn vorhanden}
BSW:
{Standpunkt der Partei, wenn vorhanden}
FDP:
{Standpunkt der Partei, wenn vorhanden}
Die Linke:
{Standpunkt der Partei, wenn vorhanden}

Beantworte die folgende Frage, indem du nur die Daten aus den unten aufgeführten Quellen verwendest.
Jede Quelle hat einen Namen, gefolgt von einem Doppelpunkt und der eigentlichen Information. Gib immer den Namen der Quelle für jede Fakten an, die du in deiner Antwort verwendest.
Wenn du die Frage nicht anhand der unten aufgeführten Quellen beantworten kannst, gib an, dass du es nicht weißt.

Jede Quelle hat einen Namen, gefolgt von einem Doppelpunkt und der eigentlichen Information. Gib immer den Namen der Quelle für jede Fakten an, die du in deiner Antwort verwendest. Verwende eckige Klammern, um auf die Quelle zu verweisen, zum Beispiel: [info1.txt]. Kombiniere keine Quellen, sondern führe jede Quelle einzeln auf, z. B.: [info1.txt][info2.pdf].
{follow_up_questions_prompt}
{injected_prompt}
`;

const FOLLOW_UP_QUESTIONS_PROMPT_CONTENT = `Erstelle 3 sehr kurze Anschlussfragen, die der Benutzer wahrscheinlich als nächstes stellen würde.
Schließe die Folgefragen in doppelte spitze Klammern ein. Beispiel:
<<Wie vergleicht sich die Wirtschaftspolitik der Partei mit denen der FPD?>>
<<Welche Parteien haben einen ähnlichen Ansatz zur Migrationspolitik?>>
<<Wie begründen die Grünen das Verbrennerverbot?>>

Wiederhole keine Fragen, die bereits gestellt wurden.
Achte darauf, dass die letzte Frage mit „>>“ endet.`;

const QUERY_PROMPT_TEMPLATE = `Nachfolgend finden Sie einen Verlauf der bisherigen Konversation und eine neue Frage des Nutzers, die durch eine Suche in einer Wissensdatenbank über Wahlprogramme zur Bundestagswahl der größten Parteien beantwortet werden muss.
Erstelle eine Suchanfrage auf der Grundlage der Konversation und der neuen Frage.
Nehme keine zitierten Quelldateinamen und Dokumentennamen wie z.B. info.txt oder Wahlprogramm-Partei.md in die Suchanfrage auf.
Füge keinen Text innerhalb von [] oder <<>> in die Suchabfrage ein.
Füge keine Sonderzeichen wie '+' ein.
Wenn die Frage nicht auf Deutsch ist, übersetze die Frage ins Deutsche, bevor du die Suchabfrage erstellst.
Wenn du keine Suchabfrage erstellen kannst, gebe nur die Zahl 0 zurück.
`;

const QUERY_PROMPT_FEW_SHOTS: Message[] = [
  { role: 'user', content: 'Wie ist die Migrationspolitik der AFD??' },
  { role: 'assistant', content: 'Migrationspolitik' },
  { role: 'user', content: 'Wie ist die Wirtschaftspolitik der SPD?' },
  { role: 'assistant', content: 'Wirtschaftspolitik' },
];

/**
 * Simple retrieve-then-read implementation, using the AI Search and OpenAI APIs directly.
 * It first retrieves top documents from search, then constructs a prompt with them, and then uses
 * OpenAI to generate an completion (answer) with that prompt.
 */
export class ChatReadRetrieveRead extends ApproachBase implements ChatApproach {
  chatGptTokenLimit: number;

  constructor(
    search: SearchClient<any>,
    openai: OpenAiService,
    chatGptModel: string,
    embeddingModel: string,
    sourcePageField: string,
    contentField: string,
  ) {
    super(search, openai, chatGptModel, embeddingModel, sourcePageField, contentField);
    this.chatGptTokenLimit = getTokenLimit(chatGptModel);
  }

  async run(messages: Message[], context?: ChatApproachContext): Promise<ApproachResponse> {
    const { completionRequest, dataPoints, thoughts } = await this.baseRun(messages, context);
    const openAiChat = await this.openai.getChat();
    const chatCompletion = await openAiChat.completions.create(completionRequest);
    const chatContent = chatCompletion.choices[0].message.content ?? '';

    return {
      choices: [
        {
          index: 0,
          message: {
            content: chatContent,
            role: 'assistant',
            context: {
              data_points: {
                text: dataPoints,
              },
              thoughts: thoughts,
            },
          },
        },
      ],
      object: 'chat.completion',
    };
  }

  async *runWithStreaming(
    messages: Message[],
    context?: ChatApproachContext,
  ): AsyncGenerator<ApproachResponseChunk, void> {
    const { completionRequest, dataPoints, thoughts } = await this.baseRun(messages, context);
    const openAiChat = await this.openai.getChat();
    const chatCompletion = await openAiChat.completions.create({
      ...completionRequest,
      stream: true,
    });
    let id = 0;
    for await (const chunk of chatCompletion) {
      const responseChunk = {
        choices: [
          {
            index: 0,
            delta: {
              content: chunk.choices[0]?.delta.content ?? '',
              role: 'assistant' as const,
              context: {
                data_points: id === 0 ? { text: dataPoints } : undefined,
                thoughts: id === 0 ? thoughts : undefined,
              },
            },
            finish_reason: chunk.choices[0]?.finish_reason,
          },
        ],
        object: 'chat.completion.chunk' as const,
      };
      yield responseChunk;
      id++;
    }
  }

  private async baseRun(messages: Message[], context?: ChatApproachContext) {
    const userQuery = 'Generate search query for: ' + messages[messages.length - 1].content;

    // STEP 1: Generate an optimized keyword search query based on the chat history and the last question
    // -----------------------------------------------------------------------

    const initialMessages = this.getMessagesFromHistory(
      QUERY_PROMPT_TEMPLATE,
      this.chatGptModel,
      messages,
      userQuery,
      QUERY_PROMPT_FEW_SHOTS,
      this.chatGptTokenLimit - userQuery.length,
    );

    const openAiChat = await this.openai.getChat();
    const chatCompletion = await openAiChat.completions.create({
      model: this.chatGptModel,
      messages: initialMessages,
      temperature: 0,
      max_tokens: 32,
      n: 1,
    });

    let queryText = chatCompletion.choices[0].message.content?.trim();
    if (queryText === '0') {
      // Use the last user input if we failed to generate a better query
      queryText = messages[messages.length - 1].content;
    }

    // STEP 2: Retrieve relevant documents from the search index with the GPT optimized query
    // -----------------------------------------------------------------------

    const { query, results, content } = await this.searchDocuments(queryText, context);
    const followUpQuestionsPrompt = context?.suggest_followup_questions ? FOLLOW_UP_QUESTIONS_PROMPT_CONTENT : '';

    // STEP 3: Generate a contextual and content specific answer using the search results and chat history
    // -----------------------------------------------------------------------

    // Allow client to replace the entire prompt, or to inject into the exiting prompt using >>>
    const promptOverride = context?.prompt_template;
    let systemMessage: string;
    if (promptOverride?.startsWith('>>>')) {
      systemMessage = SYSTEM_MESSAGE_CHAT_CONVERSATION.replace(
        '{follow_up_questions_prompt}',
        followUpQuestionsPrompt,
      ).replace('{injected_prompt}', promptOverride.slice(3) + '\n');
    } else if (promptOverride) {
      systemMessage = SYSTEM_MESSAGE_CHAT_CONVERSATION.replace(
        '{follow_up_questions_prompt}',
        followUpQuestionsPrompt,
      ).replace('{injected_prompt}', promptOverride);
    } else {
      systemMessage = SYSTEM_MESSAGE_CHAT_CONVERSATION.replace(
        '{follow_up_questions_prompt}',
        followUpQuestionsPrompt,
      ).replace('{injected_prompt}', '');
    }

    const finalMessages = this.getMessagesFromHistory(
      systemMessage,
      this.chatGptModel,
      messages,
      // Model does not handle lengthy system messages well.
      // Moving sources to latest user conversation to solve follow up questions prompt.
      `${messages[messages.length - 1].content}\n\nSources:\n${content}`,
      [],
      this.chatGptTokenLimit,
    );

    const firstQuery = messagesToString(initialMessages);
    const secondQuery = messagesToString(finalMessages);
    const thoughts = `Search query:
${query}

Conversations:
${firstQuery}

${secondQuery}`.replaceAll('\n', '<br>');

    return {
      completionRequest: {
        model: this.chatGptModel,
        messages: finalMessages,
        temperature: Number(context?.temperature ?? 0.7),
        max_tokens: 1024,
        n: 1,
      },
      dataPoints: results,
      thoughts,
    };
  }

  private getMessagesFromHistory(
    systemPrompt: string,
    model: string,
    history: Message[],
    userContent: string,
    fewShots: Message[] = [],
    maxTokens = 4096,
  ): Message[] {
    const messageBuilder = new MessageBuilder(systemPrompt, model);

    // Add examples to show the chat what responses we want.
    // It will try to mimic any responses and make sure they match the rules laid out in the system message.
    for (const shot of fewShots.reverse()) {
      messageBuilder.appendMessage(shot.role, shot.content);
    }

    const appendIndex = fewShots.length + 1;
    messageBuilder.appendMessage('user', userContent, appendIndex);

    for (const historyMessage of history.slice(0, -1).reverse()) {
      if (messageBuilder.tokens > maxTokens) {
        break;
      }
      if (historyMessage.role === 'assistant' || historyMessage.role === 'user') {
        messageBuilder.appendMessage(historyMessage.role, historyMessage.content, appendIndex);
      }
    }

    return messageBuilder.messages;
  }
}
