const { Client } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const puppeteer = require("puppeteer");

const client = new Client();
let conversationState = {};

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

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
  console.log("QR Code gerado com sucesso! Escaneie com o WhatsApp.");
});

client.on("ready", () => {
  console.log("Bot está pronto!");
});

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
    if (isValidCPF(cpf)) {
      conversationState[userId + "_cpf"] = cpf;
      await message.reply("Agora, por favor, me informe seu endereço.");
      conversationState[userId] = "esperando_endereco";
    } else {
      await message.reply(
        "CPF inválido. Por favor, verifique o número e tente novamente."
      );
    }
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
    await message.reply("Informe o bairro.");
    conversationState[userId] = "esperando_bairro";
  } else if (conversationState[userId] === "esperando_bairro") {
    conversationState[userId + "_bairro"] = message.body;
    await message.reply("Informe o número da residência.");
    conversationState[userId] = "esperando_numero";
  } else if (conversationState[userId] === "esperando_numero") {
    conversationState[userId + "_numero"] = message.body;
    await message.reply(
      "Informe o complemento (se houver, ou deixe em branco)."
    );
    conversationState[userId] = "esperando_complemento";
  } else if (conversationState[userId] === "esperando_complemento") {
    conversationState[userId + "_complemento"] = message.body || "";

    const nome = conversationState[userId + "_nome"];
    const email = conversationState[userId + "_email"];
    const telefone = conversationState[userId + "_telefone"];
    const cpf = conversationState[userId + "_cpf"];
    const endereco = conversationState[userId + "_endereco"];
    const cidade = conversationState[userId + "_cidade"];
    const estado = conversationState[userId + "_estado"];
    const cep = conversationState[userId + "_cep"];
    const bairro = conversationState[userId + "_bairro"];
    const numero = conversationState[userId + "_numero"];
    const complemento = conversationState[userId + "_complemento"]; // Corrigido parêntese aqui

    const sucesso = await createAccount(
      nome,
      email,
      telefone,
      cpf,
      endereco,
      cidade,
      estado,
      cep,
      bairro,
      numero,
      complemento
    );

    if (sucesso) {
      await message.reply("Conta criada com sucesso!");
    } else {
      await message.reply(
        "Erro no cadastro. Verifique os dados e tente novamente."
      );
    }

    delete conversationState[userId];
    delete conversationState[userId + "_nome"];
    delete conversationState[userId + "_email"];
    delete conversationState[userId + "_telefone"];
    delete conversationState[userId + "_cpf"];
    delete conversationState[userId + "_endereco"];
    delete conversationState[userId + "_cidade"];
    delete conversationState[userId + "_estado"];
    delete conversationState[userId + "_cep"];
    delete conversationState[userId + "_bairro"];
    delete conversationState[userId + "_numero"];
    delete conversationState[userId + "_complemento"];
  }
});

client.initialize();

async function createAccount(
  name,
  email,
  phone,
  cpf,
  endereco,
  cidade,
  estado,
  cep,
  bairro,
  numero,
  complemento
) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log("Acessando a página de cadastro...");
    await page.goto("", {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    console.log("Preenchendo a primeira etapa...");
    await page.type("#name", name);
    await page.type("#email", email);
    await page.type("#phone", phone);
    await page.type("#cpf", cpf);

    await page.click("#termsAndAge");
    await page.click("#termsSmsEmail");

    console.log("Clicando no botão 'Próximo passo'...");
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll("button")];
      const nextButton = buttons.find(
        (btn) => btn.innerText === "Próximo passo"
      );
      if (nextButton) nextButton.click();
    });

    console.log("Aguardando a segunda etapa...");
    await page.waitForSelector("#zipCode", { visible: true, timeout: 60000 });

    console.log("Preenchendo a segunda etapa...");
    await page.type("#zipCode", cep);
    await page.type("#street", endereco);
    await page.type("#neighborhood", bairro);
    await page.type("#number", numero);
    await page.type("#complement", complemento);

    console.log("Finalizando cadastro...");
    await page.click("#submitButton");

    console.log("Aguardando confirmação de cadastro...");
    const successSelector = ".confirmation";
    await page.waitForSelector(successSelector, { timeout: 60000 });

    await page.screenshot({ path: "cadastro_confirmacao.png" });
    console.log("Cadastro finalizado com sucesso. Captura de tela salva.");

    return true;
  } catch (error) {
    console.error("Erro durante o cadastro:", error);
    await page.screenshot({ path: "erro_cadastro.png" });
    console.log("Erro capturado. Captura de tela salva.");
    return false;
  } finally {
    await browser.close();
  }
}
