import { Command } from "commander";
import { runInit } from "./commands/init.js";
import { runGenerate } from "./commands/generate.js";
import { runRegister } from "./commands/register.js";
import { runClaim } from "./commands/claim.js";
import { runAuth } from "./commands/auth.js";
import { registerFsCommands } from "./commands/fs.js";

const program = new Command();

program.name("nkmc").description("nkmc SDK CLI").version("0.1.0");

program
  .command("init")
  .description("Initialize nkmc in the current project")
  .argument("[dir]", "Project directory", ".")
  .action(async (dir: string) => {
    const projectDir = dir === "." ? process.cwd() : dir;
    await runInit(projectDir);
  });

program
  .command("generate")
  .description("Scan project and generate skill.md")
  .argument("[dir]", "Project directory", ".")
  .option("--register", "Register the service with the gateway after generating")
  .option("--gateway-url <url>", "Gateway URL for registration")
  .option("--token <token>", "Auth token for registration (publish token or admin token)")
  .option("--admin-token <token>", "Admin token for registration (deprecated, use --token)")
  .option("--domain <domain>", "Domain name for the service")
  .action(async (dir: string, opts: Record<string, string | boolean | undefined>) => {
    const projectDir = dir === "." ? process.cwd() : dir;
    await runGenerate(projectDir, {
      register: opts.register as boolean | undefined,
      gatewayUrl: opts.gatewayUrl as string | undefined,
      token: opts.token as string | undefined,
      adminToken: opts.adminToken as string | undefined,
      domain: opts.domain as string | undefined,
    });
  });

program
  .command("claim <domain>")
  .description("Claim domain ownership via DNS verification")
  .option("--verify", "Verify DNS record and obtain publish token")
  .option("--gateway-url <url>", "Gateway URL")
  .action(async (domain: string, opts: Record<string, string | boolean | undefined>) => {
    const gatewayUrl =
      (opts.gatewayUrl as string | undefined) ?? process.env.NKMC_GATEWAY_URL ?? "https://api.nkmc.ai";
    await runClaim({
      gatewayUrl,
      domain,
      verify: opts.verify as boolean | undefined,
    });
  });

program
  .command("register")
  .description("Register skill.md with the gateway")
  .option("--gateway-url <url>", "Gateway URL")
  .option("--token <token>", "Auth token (publish token or admin token)")
  .option("--admin-token <token>", "Admin token (deprecated, use --token)")
  .option("--domain <domain>", "Domain name for the service")
  .option("--dir <dir>", "Project directory", ".")
  .action(async (opts: Record<string, string | undefined>) => {
    await runRegister({
      gatewayUrl: opts.gatewayUrl,
      token: opts.token,
      adminToken: opts.adminToken,
      domain: opts.domain,
      dir: opts.dir === "." ? process.cwd() : opts.dir,
    });
  });

program
  .command("auth")
  .description("Authenticate with the nkmc gateway")
  .option("--gateway-url <url>", "Gateway URL (default: https://api.nkmc.ai)")
  .action(async (opts: Record<string, string | undefined>) => {
    await runAuth({ gatewayUrl: opts.gatewayUrl });
  });

registerFsCommands(program);

program.parse();
