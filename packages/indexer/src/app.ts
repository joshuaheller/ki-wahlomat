import path, { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type FastifyPluginAsync } from 'fastify';
import AutoLoad, { type AutoloadPluginOptions } from '@fastify/autoload';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';

export type AppOptions = {
  // Place your custom options for app below here.
} & Partial<AutoloadPluginOptions>;

// Pass --options via CLI arguments in command to enable these options.
const options: AppOptions = {};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: FastifyPluginAsync<AppOptions> = async (fastify, options_): Promise<void> => {
  // Place here your custom code!

  fastify.register(cors, {});

  // Configure multipart with larger limits
  fastify.register(multipart, {
    limits: {
      fieldSize: 100 * 1024 * 1024, // 100MB field size
      fileSize: 100 * 1024 * 1024,  // 100MB file size
      files: 10,                     // Max number of files
    }
  });

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  fastify.register(AutoLoad, {
    dir: join(__dirname, 'plugins'),
    options: options_,
  });

  // This loads all plugins defined in routes
  // define your routes in one of these
  fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    options: options_,
  });
};

export default app;
export { app, options };
