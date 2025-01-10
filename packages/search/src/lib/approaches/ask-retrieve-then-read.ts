import { type SearchClient } from '@azure/search-documents';
import { type OpenAiService } from '../../plugins/openai.js';
import { messagesToString } from '../message.js';
import { MessageBuilder } from '../message-builder.js';
import {
  type ApproachResponse,
  type ApproachContext,
  type AskApproach,
  type ApproachResponseChunk,
} from './approach.js';
import { ApproachBase } from './approach-base.js';

const SYSTEM_CHAT_TEMPLATE = `
Du bist ein politisch neutraler Assistent, der thematische Fragen über Parteien beantwortet, anhand deren Wahlprogramm. Du bist sachlich und faktenorientiert.

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
Wenn du die Frage nicht anhand der unten aufgeführten Quellen beantworten kannst, gib an, dass du es nicht weißt.`;

/**
 * Simple retrieve-then-read implementation, using the AI Search and OpenAI APIs directly.
 * It first retrieves top documents from search, then constructs a prompt with them, and then uses
 * OpenAI to generate an completion (answer) with that prompt.
 * 
 * Example:
 * Question: "What happens if a guest breaks something?"
 * Sources:
 * info1.txt: Compensation for Damage Accidents can happen during a stay...
 * info2.pdf: Guests must not engage in any prohibited activities...
 * info3.pdf: Once you've provided the necessary information...
 * 
 * Answer: If a guest breaks something, report the damage immediately through the platform [info1.txt].
 * Once you've provided the necessary information, submit the report...
 */
export class AskRetrieveThenRead extends ApproachBase implements AskApproach {
  constructor(
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
    const { query, results, content } = await this.searchDocuments(userQuery, context);
    const messageBuilder = new MessageBuilder(context?.prompt_template || SYSTEM_CHAT_TEMPLATE, this.chatGptModel);

    // Add user question
    const userContent = `${userQuery}\nSources:\n${content}`;
    messageBuilder.appendMessage('user', userContent);

    // Add shots/samples. This helps model to mimic response and make sure they match rules laid out in system message.
    // messageBuilder.appendMessage('assistant', QUESTION);
    // messageBuilder.appendMessage('user', ANSWER);

    const messages = messageBuilder.messages;

    const openAiChat = await this.openai.getChat();
    const chatCompletion = await openAiChat.completions.create({
      model: this.chatGptModel,
      messages,
      temperature: Number(context?.temperature ?? 0.1),
      max_tokens: 4000,
      n: 1,
    });

    const messageToDisplay = messagesToString(messages);

    return {
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant' as const,
            content: chatCompletion.choices[0].message.content ?? '',
            context: {
              data_points: {
                text: results,
              },
              thoughts: `Question:<br>${query}<br><br>Prompt:<br>${messageToDisplay.replace('\n', '<br>')}`,
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
