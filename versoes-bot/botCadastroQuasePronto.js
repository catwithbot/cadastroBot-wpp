const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const puppeteer = require("puppeteer");

const client = new Client({
  authStrategy: new LocalAuth(),
});

let conversationState = {};

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
  console.log("QR Code gerado com sucesso! Escaneie com o WhatsApp.");
});

client.on("ready", () => {
  console.log("Bot está pronto!");
});

function isValidCPF(cpf) {
  cpf = cpf.replace(/[^\d]+/g, "");
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let sum = 0,
    remainder;
  for (let i = 1; i <= 9; i++)
    sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.substring(9, 10))) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++)
    sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(cpf.substring(10, 11));
}

function isValidPhone(phone) {
  const phonePattern = /^(\d{2})9\d{8}$/;
  return phonePattern.test(phone);
}

function isValidName(name) {
  return name.trim().split(" ").length > 1;
}

function isValidEmail(email) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

client.on("message", async (message) => {
  const userId = message.from;

  if (!conversationState[userId]) {
    await message.reply(
      "Olá! Bem-vindo ao nosso serviço de cadastro. Por favor, digite seu nome completo para iniciar."
    );
    conversationState[userId] = "esperando_nome";
  } else if (conversationState[userId] === "esperando_nome") {
    const name = message.body;
    if (isValidName(name)) {
      conversationState[userId + "_nome"] = name;
      await message.reply("Obrigado! Agora, por favor, me envie seu e-mail.");
      conversationState[userId] = "esperando_email";
    } else {
      await message.reply(
        "Por favor, insira seu nome completo (nome e sobrenome)."
      );
    }
  } else if (conversationState[userId] === "esperando_email") {
    const email = message.body;
    if (isValidEmail(email)) {
      conversationState[userId + "_email"] = email;
      await message.reply(
        "Ótimo! Agora, por favor, me envie seu telefone com DDD (exemplo: 11987654321)."
      );
      conversationState[userId] = "esperando_telefone";
    } else {
      await message.reply(
        "E-mail inválido. Certifique-se de que ele contém '@' e um domínio."
      );
    }
  } else if (conversationState[userId] === "esperando_telefone") {
    const phone = message.body;
    if (isValidPhone(phone)) {
      conversationState[userId + "_telefone"] = phone;
      await message.reply(
        "Perfeito! Agora, por favor, me envie seu CPF (apenas números)."
      );
      conversationState[userId] = "esperando_cpf";
    } else {
      await message.reply(
        "Número de telefone inválido. Certifique-se de que possui 11 dígitos com DDD, começando com 9."
      );
    }
  } else if (conversationState[userId] === "esperando_cpf") {
    const cpf = message.body;
    await message.reply("Validando o CPF, por favor, aguarde...");
    setTimeout(async () => {
      if (isValidCPF(cpf)) {
        conversationState[userId + "_cpf"] = cpf;
        await message.reply("Agora, por favor, me informe seu endereço.");
        conversationState[userId] = "esperando_endereco";
      } else {
        await message.reply(
          "CPF inválido. Por favor, verifique o número e tente novamente."
        );
      }
    }, 2000);
  } else if (conversationState[userId] === "esperando_endereco") {
    conversationState[userId + "_endereco"] = message.body;
    await message.reply("Informe a cidade.");
    conversationState[userId] = "esperando_cidade";
  } else if (conversationState[userId] === "esperando_cidade") {
    conversationState[userId + "_cidade"] = message.body;
    await message.reply("Informe o estado.");
    conversationState[userId] = "esperando_estado";
  } else if (conversationState[userId] === "esperando_estado") {
    conversationState[userId + "_estado"] = message.body;
    await message.reply("Por fim, informe o CEP.");
    conversationState[userId] = "esperando_cep";
  } else if (conversationState[userId] === "esperando_cep") {
    conversationState[userId + "_cep"] = message.body;

    console.log("Iniciando cadastro com Puppeteer...");
    const success = await createAccount(
      conversationState[userId + "_nome"],
      conversationState[userId + "_email"],
      conversationState[userId + "_telefone"],
      conversationState[userId + "_cpf"],
      conversationState[userId + "_endereco"],
      conversationState[userId + "_cidade"],
      conversationState[userId + "_estado"],
      conversationState[userId + "_cep"]
    );

    if (success) {
      await message.reply("Cadastro finalizado com sucesso! Obrigado.");
    } else {
      await message.reply(
        "Houve um erro durante o cadastro. Tente novamente mais tarde."
      );
    }

    // Limpa o estado da conversa após o cadastro
    delete conversationState[userId];
  }
});

client.initialize();

// Função createAccount atualizada
async function createAccount(
  nome,
  email,
  telefone,
  cpf,
  endereco,
  cidade,
  estado,
  cep
) {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  try {
    console.log("Acessando a página inicial...");
    await page.goto("https://adesao.cartaodetodos.com.br/dados-pessoais/", {
      waitUntil: "networkidle2",
    });

    console.log("Preenchendo etapa 1: Cadastro...");
    await page.type("#name", nome);
    await page.type("#email", email);
    await page.type("#phone", telefone);
    await page.type("#cpf", cpf);

    await page.click("#termsAndAge");
    await page.click("#termsSmsEmail");

    console.log("Indo para a etapa 2...");
    await Promise.all([
      page.click("button.btn-default[type='submit']"),
      page.waitForSelector("#zipCode", { timeout: 15000 }),
    ]);

    console.log("Preenchendo etapa 2: Endereço...");
    await page.type("#zipCode", cep);
    await page.type("#street", endereco);
    await page.type("#neighborhood", cidade); // Ajuste conforme necessário
    await page.type("#number", "S/N"); // Você pode pedir o número ao usuário se necessário
    await page.type("#complement", estado); // Ajuste conforme necessário

    console.log("Simulando validação dos campos...");
    const inputs = [
      "#zipCode",
      "#street",
      "#neighborhood",
      "#number",
      "#complement",
    ];
    for (const input of inputs) {
      await page.focus(input);
      await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        element.blur();
      }, input);
    }

    console.log("Aguardando botão 'Próximo passo' ser habilitado...");
    await page.waitForFunction(
      () =>
        !document.querySelector("button.btn-default[type='submit']").disabled,
      { timeout: 10000 }
    );

    console.log("Indo para a etapa 3...");
    await Promise.all([
      page.click("button.btn-default[type='submit']"),
      page.waitForFunction(
        () => document.querySelector("h1").innerText.includes("Adicionais"),
        { timeout: 15000 }
      ),
    ]);

    console.log("Pulando etapa 3: Adicionais...");

    console.log("Verificando botão 'Próximo passo' na etapa 3...");
    await page.evaluate(() => {
      const buttons = Array.from(
        document.querySelectorAll("button.btn-default")
      );
      const nextButton = buttons.find((button) =>
        button.innerText.includes("Próximo passo")
      );
      if (nextButton) {
        nextButton.click();
      } else {
        throw new Error("Botão 'Próximo passo' não encontrado.");
      }
    });

    console.log("Aguardando a etapa de pagamento...");
    await page.waitForSelector("#number", { timeout: 15000 });

    console.log("Preenchendo etapa 4: Pagamento...");
    // Aqui você pode pedir os dados do cartão ou usar dados de teste
    await page.type("#number", "4111111111111111");
    await page.type("#name", nome);
    await page.type("#validate", "12/29");
    await page.type("#cvv", "123");
    await page.type("#cpf", cpf);

    console.log("Finalizando o cadastro...");
    await page.click("button.btn-default");
    await page.waitForSelector(".finalConfirmation", { timeout: 60000 });

    console.log("Cadastro concluído com sucesso!");
    await browser.close();
    return true;
  } catch (error) {
    console.error("Erro durante o cadastro:", error.message);

    await page.screenshot({ path: "error_create_account.png" });
    console.log("Captura de tela salva como 'error_create_account.png'.");
    await browser.close();
    return false;
  }
}
