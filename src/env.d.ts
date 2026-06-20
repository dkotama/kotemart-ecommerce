/// <reference types="astro/client" />
/// <reference types="@cloudflare/workers-types" />

declare namespace App {
  interface Locals {
    user: import('./lib/types').User | null;
    runtime: {
      env: import('./lib/types').Env;
    };
  }
}
