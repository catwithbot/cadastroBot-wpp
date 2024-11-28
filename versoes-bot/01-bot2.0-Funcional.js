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

// Funções de validação
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

function isValidCardDate(date) {
  const datePattern = /^(0[1-9]|1[0-2])\/\d{2}$/;
  return datePattern.test(date);
}

// Fluxo de mensagens
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
    await message.reply("Por favor, informe o número da sua residência.");
    conversationState[userId] = "esperando_numero_residencia";
  } else if (conversationState[userId] === "esperando_numero_residencia") {
    const numeroResidencia = message.body;
    if (/^\d+$/.test(numeroResidencia)) {
      conversationState[userId + "_numero_residencia"] = numeroResidencia;
      await message.reply(
        "Agora precisamos dos dados do pagamento. Por favor, insira o número do seu cartão de crédito (16 dígitos)."
      );
      conversationState[userId] = "esperando_numero_cartao";
    } else {
      await message.reply(
        "Número da residência inválido. Por favor, insira apenas números."
      );
    }
  } else if (conversationState[userId] === "esperando_numero_cartao") {
    const numeroCartao = message.body.replace(/\s+/g, ""); // Remove espaços
    if (/^\d{16}$/.test(numeroCartao)) {
      conversationState[userId + "_numero_cartao"] = numeroCartao;
      await message.reply(
        "Número do cartão recebido. Agora, informe a validade do cartão no formato MM/AA."
      );
      conversationState[userId] = "esperando_validade_cartao";
    } else {
      await message.reply(
        "Número de cartão inválido. Por favor, insira exatamente 16 dígitos sem espaços ou caracteres especiais."
      );
    }
  } else if (conversationState[userId] === "esperando_validade_cartao") {
    const validade = message.body;
    if (isValidCardDate(validade)) {
      conversationState[userId + "_validade_cartao"] = validade;
      await message.reply(
        "Agora, informe o CVV (3 dígitos no verso do cartão)."
      );
      conversationState[userId] = "esperando_cvv";
    } else {
      await message.reply(
        "Data de validade inválida. Por favor, insira no formato MM/AA."
      );
    }
  } else if (conversationState[userId] === "esperando_cvv") {
    const cvv = message.body;
    if (/^\d{3}$/.test(cvv)) {
      conversationState[userId + "_cvv"] = cvv;
      await message.reply("Dados recebidos. Iniciando o cadastro...");

      // Inicia o preenchimento com Puppeteer
      const success = await createAccount(
        conversationState[userId + "_nome"],
        conversationState[userId + "_email"],
        conversationState[userId + "_telefone"],
        conversationState[userId + "_cpf"],
        conversationState[userId + "_endereco"],
        conversationState[userId + "_cidade"],
        conversationState[userId + "_estado"],
        conversationState[userId + "_cep"],
        conversationState[userId + "_numero_residencia"],
        conversationState[userId + "_numero_cartao"],
        conversationState[userId + "_validade_cartao"],
        conversationState[userId + "_cvv"]
      );

      if (success) {
        await message.reply("Cadastro e pagamento concluídos com sucesso!");
      } else {
        await message.reply(
          "Houve um erro durante o cadastro. Por favor, tente novamente mais tarde."
        );
      }

      // Limpa o estado da conversa após o cadastro
      delete conversationState[userId];
    } else {
      await message.reply(
        "CVV inválido. Por favor, insira exatamente 3 dígitos."
      );
    }
  }
});

// Lógica de Navegação no Puppeteer
// Lógica de Navegação no Puppeteer
// Lógica de Navegação no Puppeteer
async function createAccount(
  nome,
  email,
  telefone,
  cpf,
  endereco,
  cidade,
  estado,
  cep,
  numeroResidencia,
  numeroCartao,
  validadeCartao,
  cvv
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

    console.log("Verificando botão 'Próximo passo'...");
    await page.waitForFunction(
      () => {
        const button = document.querySelector(
          "button.btn-default[type='submit']"
        );
        return button && !button.disabled;
      },
      { timeout: 15000 }
    );

    // Forçar clique no botão
    console.log("Tentando avançar para a etapa 2...");
    await page.evaluate(() => {
      const button = document.querySelector(
        "button.btn-default[type='submit']"
      );
      if (button) {
        button.click();
      } else {
        throw new Error(
          "Botão 'Próximo passo' não encontrado ou não clicável."
        );
      }
    });

    // Esperar o próximo formulário carregar
    console.log("Aguardando carregamento da etapa 2...");
    await page.waitForSelector("#zipCode", { timeout: 15000 });
    console.log("Etapa 2 acessada com sucesso.");

    console.log("Preenchendo etapa 2: Endereço...");
    await page.type("#zipCode", cep);
    await page.type("#street", endereco);
    await page.type("#neighborhood", cidade);
    await page.type("#number", numeroResidencia);
    await page.type("#complement", estado);

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
        element.blur(); // Simula sair do campo para validação
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
    await page.waitForSelector("input[name='number']", { timeout: 15000 });

    console.log("Preenchendo etapa 4: Pagamento...");

    // Preenchendo campos de cartão de crédito
    await page.type("#number", numeroCartao);
    await page.evaluate(() => document.querySelector("#number").blur()); // Simula validação
    await page.type("#name", nome);
    await page.type("#validate", validadeCartao);
    await page.type("#cvv", cvv);

    // Preenchendo o campo de CPF na etapa 4
    console.log("Preenchendo CPF na etapa 4...");
    await page.type("#cpf", cpf);
    await page.evaluate(() => document.querySelector("#cpf").blur()); // Simula validação

    // Garantindo que o botão "Realizar pagamento" esteja habilitado
    await page.waitForFunction(
      () => {
        const button = document.querySelector("button.btn-default");
        return button && !button.disabled;
      },
      { timeout: 15000 }
    );

    // Clique no botão para finalizar pagamento
    console.log("Realizando pagamento...");
    await Promise.all([
      page.click("button.btn-default"),
      page.waitForSelector(".finalConfirmation", { timeout: 60000 }), // Aguarda a confirmação
    ]);

    console.log("Cadastro e pagamento concluídos com sucesso!");
    await browser.close();
    return true;
  } catch (error) {
    console.error("Erro na etapa de pagamento:", error.message);

    // Fecha o navegador em caso de erro
    await browser.close();
    return false;
  }
}

// Inicialização do cliente
client.initialize();
