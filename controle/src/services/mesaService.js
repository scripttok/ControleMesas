import firebase from "firebase/compat/app";
import "firebase/compat/database";
import { ensureFirebaseInitialized } from "./firebase";
import { Alert } from "react-native";

const waitForConnection = async (db, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const connectedRef = db.ref(".info/connected");
    let resolved = false;

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        reject(
          new Error("Tempo limite excedido esperando conexão com Firebase")
        );
      }
    }, timeout);

    connectedRef.once("value", (snapshot) => {
      if (snapshot.val() === true) {
        clearTimeout(timeoutId);
        resolved = true;
        resolve(db);
      } else {
        db.goOnline();
        connectedRef.on("value", (snap) => {
          if (snap.val() === true) {
            clearTimeout(timeoutId);
            resolved = true;
            connectedRef.off();
            resolve(db);
          }
        });
      }
    });
  });
};

export const adicionarMesaNoFirebase = async (mesa) => {
  const freshDb = await ensureFirebaseInitialized();
  await waitForConnection(freshDb);
  "(NOBRIDGE) LOG Adicionando mesa ao Firebase:", mesa;
  return freshDb
    .ref("mesas")
    .push({ ...mesa, createdAt: firebase.database.ServerValue.TIMESTAMP }).key;
};

export const getMesas = (callback) => {
  let ref;
  const setupListener = async () => {
    const freshDb = await ensureFirebaseInitialized();
    if (!freshDb) {
      console.error(
        "(NOBRIDGE) ERROR Firebase DB não inicializado em getMesas"
      );
      callback([]);
      return;
    }
    ref = freshDb.ref("mesas");
    ref.on(
      "value",
      (snapshot) => {
        const data = snapshot.val();
        "(NOBRIDGE) LOG Mesas recebidas:", data;
        callback(
          data
            ? Object.entries(data).map(([id, value]) => ({ id, ...value }))
            : []
        );
      },
      (error) => {
        console.error("(NOBRIDGE) ERROR Erro em getMesas:", error);
        callback([]);
      }
    );
  };
  setupListener();
  return () => {
    if (ref) {
      ("(NOBRIDGE) LOG Desmontando listener de mesas");
      ref.off("value");
    }
  };
};

export const getPedidos = (callback) => {
  let ref;
  const setupListener = async () => {
    const freshDb = await ensureFirebaseInitialized();
    if (!freshDb) {
      console.error(
        "(NOBRIDGE) ERROR Firebase DB não inicializado em getPedidos"
      );
      callback([]);
      return;
    }
    ref = freshDb.ref("pedidos");
    ref.on(
      "value",
      (snapshot) => {
        const data = snapshot.val();
        "(NOBRIDGE) LOG Pedidos recebidos:", data;
        callback(
          data
            ? Object.entries(data).map(([id, value]) => ({ id, ...value }))
            : []
        );
      },
      (error) => {
        console.error("(NOBRIDGE) ERROR Erro em getPedidos:", error);
        callback([]);
      }
    );
  };
  setupListener();
  return () => {
    if (ref) {
      ("(NOBRIDGE) LOG Desmontando listener de pedidos");
      ref.off("value");
    }
  };
};

export const atualizarMesa = async (mesaId, updates) => {
  const freshDb = await ensureFirebaseInitialized();
  await waitForConnection(freshDb);
  if (!freshDb) {
    console.error(
      "(NOBRIDGE) ERROR Firebase DB não inicializado em atualizarMesa"
    );
    throw new Error("Firebase DB não inicializado.");
  }
  try {
    const ref = freshDb.ref(`mesas/${mesaId}`);
    if (!ref) {
      console.error("(NOBRIDGE) ERROR Referência inválida para mesa:", mesaId);
      throw new Error("Referência ao Firebase inválida.");
    }
    if (updates === null) {
      "(NOBRIDGE) LOG Removendo mesa:", mesaId;
      await ref.remove();
    } else {
      "(NOBRIDGE) LOG Atualizando mesa:", mesaId, updates;
      await ref.update(updates);
    }
    "(NOBRIDGE) LOG Mesa atualizada com sucesso:", mesaId;
  } catch (error) {
    console.error("(NOBRIDGE) ERROR Erro ao atualizar/remover mesa:", error);
    throw error;
  }
};

export const juntarMesas = async (mesaId1, mesaId2) => {
  const freshDb = await ensureFirebaseInitialized();
  await waitForConnection(freshDb);
  try {
    const refMesa1 = freshDb.ref(`mesas/${mesaId1}`);
    const refMesa2 = freshDb.ref(`mesas/${mesaId2}`);
    const snapshotMesa1 = await refMesa1.once("value");
    const snapshotMesa2 = await refMesa2.once("value");

    const mesa1 = snapshotMesa1.val();
    const mesa2 = snapshotMesa2.val();

    if (!mesa1 || !mesa2) {
      throw new Error("Uma ou ambas as mesas não foram encontradas.");
    }

    if (mesa1.status === "fechada" || mesa2.status === "fechada") {
      throw new Error("Não é possível juntar uma mesa com status 'fechada'.");
    }

    const novoNomeCliente = `${mesa1.nomeCliente} & ${mesa2.nomeCliente}`;

    const pedidosSnapshot = await freshDb.ref("pedidos").once("value");
    const todosPedidos = pedidosSnapshot.val() || {};
    const pedidosMesa1 = Object.entries(todosPedidos)
      .filter(([_, pedido]) => pedido.mesa === mesaId1)
      .map(([id, pedido]) => ({ id, ...pedido, mesaOriginal: mesaId1 }));
    const pedidosMesa2 = Object.entries(todosPedidos)
      .filter(([_, pedido]) => pedido.mesa === mesaId2)
      .map(([id, pedido]) => ({ id, ...pedido, mesaOriginal: mesaId2 }));

    const novaMesa = {
      nomeCliente: novoNomeCliente,
      posX: mesa1.posX || 0,
      posY: mesa1.posY || 0,
      status: "aberta",
      createdAt: mesa1.createdAt,
    };

    const updates = {};
    [...pedidosMesa1, ...pedidosMesa2].forEach((pedido) => {
      updates[`pedidos/${pedido.id}/mesa`] = mesaId1; // Mantém pedidos na mesa1
      if (!pedido.mesaOriginal) {
        updates[`pedidos/${pedido.id}/mesaOriginal`] = pedido.mesa;
      }
    });
    updates[`mesas/${mesaId1}`] = novaMesa;
    updates[`mesas/${mesaId2}`] = null;

    await freshDb.ref().update(updates);
    "(NOBRIDGE) LOG Mesas juntadas com sucesso:",
      novoNomeCliente,
      "Pedidos combinados:",
      [...pedidosMesa1, ...pedidosMesa2];
  } catch (error) {
    throw error;
  }
};

export const adicionarPedido = async (mesaId, itens) => {
  const freshDb = await ensureFirebaseInitialized();
  await waitForConnection(freshDb);
  try {
    const pedido = {
      mesa: mesaId,
      itens,
      status: "aguardando",
      entregue: false,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
    };
    "(NOBRIDGE) LOG Adicionando pedido:", pedido;
    const pedidoId = await freshDb.ref("pedidos").push(pedido).key;
    "(NOBRIDGE) LOG Pedido adicionado com sucesso:", pedidoId;
    return pedidoId;
  } catch (error) {
    console.error("(NOBRIDGE) ERROR Erro ao adicionar pedido:", error);
    throw error;
  }
};

export const getEstoque = (callback) => {
  let ref;
  const setupListener = async () => {
    const freshDb = await ensureFirebaseInitialized();
    ref = freshDb.ref("estoque");
    ref.on(
      "value",
      (snapshot) => {
        const data = snapshot.val();
        "(NOBRIDGE) LOG Estoque recebido:", data;
        callback(
          data
            ? Object.entries(data).map(([id, value]) => ({ id, ...value }))
            : []
        );
      },
      (error) => {
        console.error("(NOBRIDGE) ERROR Erro em getEstoque:", error);
        callback([]);
      }
    );
  };
  setupListener();
  return () => {
    if (ref) {
      ("(NOBRIDGE) LOG Desmontando listener de estoque");
      ref.off("value");
    }
  };
};

export const getCardapio = (callback) => {
  let ref;
  const setupListener = async () => {
    const freshDb = await ensureFirebaseInitialized();
    ref = freshDb.ref("cardapio");
    ref.on(
      "value",
      (snapshot) => {
        const data = snapshot.val();
        "(NOBRIDGE) LOG Cardápio recebido em mesaService:", data;
        if (data) {
          const itens = [];
          Object.entries(data).forEach(([categoria, subItens]) => {
            Object.values(subItens).forEach((item) => {
              itens.push({
                nome: item.nome,
                precoUnitario: item.precoUnitario || 0,
                imagens: item.imagens || [],
                categoria: categoria.replace(/_/g, " "),
                descrição: item.descrição || "",
              });
            });
          });
          callback(itens);
        } else {
          callback([]);
        }
      },
      (error) => {
        console.error("(NOBRIDGE) ERROR Erro em getCardapio:", error);
        callback([]);
      }
    );
  };
  setupListener();
  return () => {
    if (ref) {
      ("(NOBRIDGE) LOG Desmontando listener de cardápio");
      ref.off("value");
    }
  };
};

export const removerPedidoDoFirebase = async (pedidoId) => {
  const db = await ensureFirebaseInitialized();
  return db.ref(`historicoPedidos/${pedidoId}`).remove();
};

export const removerPedidoDoHistorico = async (pedidoId) => {
  try {
    const db = await ensureFirebaseInitialized();
    await db.ref(`historicoPedidos/${pedidoId}`).remove();
    `(NOBRIDGE) LOG Pedido ${pedidoId} removido com sucesso`;
    return true;
  } catch (error) {
    console.error("(NOBRIDGE) ERROR Erro ao remover pedido:", error);
    throw error;
  }
};

export const salvarHistoricoPedido = async (dadosPedido) => {
  const freshDb = await ensureFirebaseInitialized();
  try {
    const historicoRef = freshDb.ref("historicoPedidos");

    const novoHistorico = {
      nomeCliente: dadosPedido.nomeCliente,
      itens: Array.isArray(dadosPedido.itens)
        ? dadosPedido.itens
        : Object.values(dadosPedido.itens || {}),
      totalSemDesconto: dadosPedido.totalSemDesconto,
      desconto: dadosPedido.desconto,
      total: dadosPedido.total,
      recebido: dadosPedido.recebido,
      troco: dadosPedido.troco,
      dataFechamento: firebase.database.ServerValue.TIMESTAMP,
      historicoPagamentos: Array.isArray(dadosPedido.historicoPagamentos)
        ? dadosPedido.historicoPagamentos
        : [],
    };

    if (
      dadosPedido.pago > 0 &&
      novoHistorico.historicoPagamentos.length === 0
    ) {
      novoHistorico.historicoPagamentos.push({
        valor: dadosPedido.pago,
        metodo: dadosPedido.metodoPagamento || "dinheiro",
        data: new Date().toISOString(),
      });
    }

    const novoHistoricoRef = historicoRef.push();
    await novoHistoricoRef.set(novoHistorico);

    "Histórico salvo com ID:", novoHistoricoRef.key, "Dados:", novoHistorico;
    return novoHistoricoRef.key;
  } catch (error) {
    console.error("Erro ao salvar histórico:", error);
    throw error;
  }
};

export const getHistoricoPedidos = (callback) => {
  let ref;
  const setupListener = async () => {
    try {
      const freshDb = await ensureFirebaseInitialized();
      ref = freshDb.ref("historicoPedidos");

      ref
        .orderByChild("dataFechamento")
        .limitToLast(100)
        .on(
          "value",
          (snapshot) => {
            const data = snapshot.val();
            if (data) {
              const historico = Object.entries(data).map(([id, value]) => ({
                id,
                ...value,
                dataFechamento: value.dataFechamento
                  ? new Date(value.dataFechamento).toISOString()
                  : "",
              }));
              historico.sort((a, b) =>
                b.dataFechamento.localeCompare(a.dataFechamento)
              );
              callback(historico);
            } else {
              callback([]);
            }
          },
          (error) => {
            console.error("Erro ao obter histórico:", error);
            callback([]);
          }
        );
    } catch (error) {
      console.error("Erro ao inicializar Firebase:", error);
      callback([]);
    }
  };

  setupListener();
  return () => {
    if (ref) {
      ref.off("value");
    }
  };
};

const COMBOS_SUBITENS = {
  "Vodka Smirniff cG Coco e Red Bull": [
    { nome: "Água de coco", quantidade: 1 },
    { nome: "RedBull", quantidade: 1 },
  ],
  "Ballantines ou White Horse cG Coco e Red Bull": [
    { nome: "Água de coco", quantidade: 1 },
    { nome: "RedBull", quantidade: 1 },
  ],
  "Red Label com Gelo Coco e Red Bull": [
    { nome: "Água de coco", quantidade: 1 },
    { nome: "RedBull", quantidade: 1 },
  ],
  "Whisky 12 anos com Gelo Coco e Red Bull": [
    { nome: "Água de coco", quantidade: 1 },
    { nome: "RedBull", quantidade: 1 },
  ],
  "1 Litro Whisky Ballantines ou W Horse + 4 Red Bull + 4 G Coco": [
    { nome: "Água de coco", quantidade: 4 },
    { nome: "RedBull", quantidade: 4 },
  ],
  "1 Litro Whisky Red Label  + 4 Red Bull + 4 G Coco": [
    { nome: "Água de coco", quantidade: 4 },
    { nome: "RedBull", quantidade: 4 },
  ],
  "1 Litro Whisky Black Label  + 4 Red Bull + 4 G Coco": [
    { nome: "Água de coco", quantidade: 4 },
    { nome: "RedBull", quantidade: 4 },
  ],
};

export const atualizarStatusPedido = async (pedidoId, novoStatus) => {
  const db = await ensureFirebaseInitialized();
  try {
    "(NOBRIDGE) LOG Atualizando status do pedido:",
      {
        pedidoId,
        novoStatus,
      };
    await db.ref(`pedidos/${pedidoId}`).update({ entregue: novoStatus });

    if (novoStatus === true) {
      const pedidoSnapshot = await db.ref(`pedidos/${pedidoId}`).once("value");
      const pedido = pedidoSnapshot.val();
      "(NOBRIDGE) LOG Dados do pedido recuperado:", pedido;
      const itens = pedido?.itens || [];

      if (!itens.length) {
        console.warn(
          "(NOBRIDGE) WARN Nenhum item encontrado no pedido:",
          pedidoId
        );
        return;
      }

      for (const item of itens) {
        "(NOBRIDGE) LOG Processando item do pedido:", item;
        const { nome, quantidade } = item;

        if (COMBOS_SUBITENS[nome]) {
          "(NOBRIDGE) LOG Identificado como combo:", nome;
          const subItens = COMBOS_SUBITENS[nome];

          for (const subItem of subItens) {
            const { nome: subItemNome, quantidade: subItemQuantidade } =
              subItem;
            const quantidadeTotal = subItemQuantidade * (quantidade || 1);
            "(NOBRIDGE) LOG Baixando estoque para subitem do combo:",
              { nome: subItemNome, quantidadeTotal };

            const estoqueSnapshot = await db
              .ref(`estoque/${subItemNome}`)
              .once("value");
            const estoqueData = estoqueSnapshot.val();

            if (estoqueData) {
              const quantidadeAtual = estoqueData.quantidade || 0;
              const novaQuantidade = Math.max(
                quantidadeAtual - quantidadeTotal,
                0
              );

              if (novaQuantidade > 0) {
                await db
                  .ref(`estoque/${subItemNome}`)
                  .update({ quantidade: novaQuantidade });
                "(NOBRIDGE) LOG Estoque atualizado:",
                  {
                    nome: subItemNome,
                    novaQuantidade,
                  };
              } else {
                await db.ref(`estoque/${subItemNome}`).remove();
                "(NOBRIDGE) LOG Item removido do estoque por zerar:",
                  subItemNome;
                if (estoqueData.chaveCardapio && estoqueData.categoria) {
                  await db
                    .ref(
                      `cardapio/${estoqueData.categoria}/${estoqueData.chaveCardapio}`
                    )
                    .remove();
                  "(NOBRIDGE) LOG Item removido do cardápio:", subItemNome;
                }
              }
            } else {
              console.warn(
                "(NOBRIDGE) WARN Item não encontrado no estoque:",
                subItemNome
              );
            }
          }
        } else {
          "(NOBRIDGE) LOG Baixando estoque para item não-combo:",
            {
              nome,
              quantidade,
            };

          const estoqueSnapshot = await db.ref(`estoque/${nome}`).once("value");
          const estoqueData = estoqueSnapshot.val();

          if (estoqueData) {
            const quantidadeAtual = estoqueData.quantidade || 0;
            const novaQuantidade = Math.max(quantidadeAtual - quantidade, 0);

            if (novaQuantidade > 0) {
              await db
                .ref(`estoque/${nome}`)
                .update({ quantidade: novaQuantidade });
              "(NOBRIDGE) LOG Estoque atualizado:",
                {
                  nome,
                  novaQuantidade,
                };
            } else {
              await db.ref(`estoque/${nome}`).remove();
              "(NOBRIDGE) LOG Item removido do estoque por zerar:", nome;
              if (estoqueData.chaveCardapio && estoqueData.categoria) {
                await db
                  .ref(
                    `cardapio/${estoqueData.categoria}/${estoqueData.chaveCardapio}`
                  )
                  .remove();
                "(NOBRIDGE) LOG Item removido do cardápio:", nome;
              }
            }
          } else {
            console.warn(
              "(NOBRIDGE) WARN Item não encontrado no estoque:",
              nome
            );
          }
        }
      }
    }

    "(NOBRIDGE) LOG Status atualizado com sucesso para:",
      {
        pedidoId,
        status: novoStatus,
      };
  } catch (error) {
    console.error("(NOBRIDGE) ERROR Erro ao atualizar status:", error);
    throw error;
  }
};

export const validarEstoqueParaPedido = async (itens) => {
  const db = await ensureFirebaseInitialized();
  try {
    for (const item of itens) {
      const { nome, quantidade } = item;

      if (COMBOS_SUBITENS[nome]) {
        const subItens = COMBOS_SUBITENS[nome];
        for (const subItem of subItens) {
          const { nome: subItemNome, quantidade: subItemQuantidade } = subItem;
          const quantidadeTotal = subItemQuantidade * (quantidade || 1);

          const estoqueSnapshot = await db
            .ref(`estoque/${subItemNome}`)
            .once("value");
          const estoqueData = estoqueSnapshot.val();

          if (!estoqueData) {
            throw new Error(`Item "${subItemNome}" não encontrado no estoque.`);
          }

          const quantidadeAtual = estoqueData.quantidade || 0;
          if (quantidadeAtual < quantidadeTotal) {
            throw new Error(
              `Estoque insuficiente para "${subItemNome}". Necessário: ${quantidadeTotal}, Disponível: ${quantidadeAtual}.`
            );
          }
        }
      } else {
        const estoqueSnapshot = await db.ref(`estoque/${nome}`).once("value");
        const estoqueData = estoqueSnapshot.val();

        if (!estoqueData) {
          throw new Error(`Item "${nome}" não encontrado no estoque.`);
        }

        const quantidadeAtual = estoqueData.quantidade || 0;
        if (quantidadeAtual < quantidade) {
          throw new Error(
            `Estoque insuficiente para "${nome}". Necessário: ${quantidade}, Disponível: ${quantidadeAtual}.`
          );
        }
      }
    }
    return true;
  } catch (error) {
    console.error("(NOBRIDGE) ERROR Erro ao validar estoque:", error);
    throw error;
  }
};

export const adicionarNovoItemEstoque = async (
  nome,
  quantidade,
  unidade = "unidades",
  estoqueMinimo = 0
) => {
  const freshDb = await ensureFirebaseInitialized();
  await waitForConnection(freshDb);
  try {
    "(NOBRIDGE) LOG Iniciando adição ao estoque:",
      {
        nome,
        quantidade,
        unidade,
        estoqueMinimo,
      };
    const ref = freshDb.ref(`estoque/${nome}`);
    const snapshot = await ref.once("value");
    const itemExistente = snapshot.val();

    const novaQuantidade = itemExistente
      ? (itemExistente.quantidade || 0) + parseFloat(quantidade)
      : parseFloat(quantidade);

    const itemData = {
      nome,
      quantidade: novaQuantidade,
      unidade: unidade || (itemExistente ? itemExistente.unidade : "unidades"),
      estoqueMinimo:
        parseFloat(estoqueMinimo) ||
        (itemExistente ? itemExistente.estoqueMinimo : 0),
    };

    await ref.set(itemData);
    "(NOBRIDGE) LOG Item adicionado ao estoque com sucesso:", itemData;
  } catch (error) {
    console.error("(NOBRIDGE) ERROR Falha ao adicionar ao estoque:", error);
    throw error;
  }
};

export const removerEstoque = async (itemId, quantidade) => {
  const freshDb = await ensureFirebaseInitialized();
  await waitForConnection(freshDb);
  try {
    "(NOBRIDGE) LOG Tentando remover do estoque:",
      {
        itemId,
        quantidade,
      };
    const ref = freshDb.ref(`estoque/${itemId}`);
    const snapshot = await ref.once("value");
    const itemExistente = snapshot.val();

    if (!itemExistente) {
      throw new Error(`Item ${itemId} não encontrado no estoque.`);
    }

    const quantidadeAtual = itemExistente.quantidade || 0;
    const novaQuantidade = Math.max(
      0,
      quantidadeAtual - parseFloat(quantidade)
    );

    const itemData = {
      ...itemExistente,
      quantidade: novaQuantidade,
    };

    await ref.set(itemData);
    "(NOBRIDGE) LOG Item removido do estoque com sucesso:", itemData;
  } catch (error) {
    console.error("(NOBRIDGE) ERROR Erro ao remover do estoque:", error);
    throw error;
  }
};

export const reverterEstoquePedido = async (pedidoId) => {
  const db = await ensureFirebaseInitialized();
  try {
    "(NOBRIDGE) LOG Revertendo estoque do pedido:", pedidoId;
    const pedidoSnapshot = await db.ref(`pedidos/${pedidoId}`).once("value");
    const pedido = pedidoSnapshot.val();

    if (!pedido || !pedido.entregue) {
      console.warn(
        "(NOBRIDGE) WARN Pedido não encontrado ou não entregue:",
        pedidoId
      );
      return;
    }

    const itens = pedido.itens || [];
    for (const item of itens) {
      const { nome, quantidade } = item;

      if (COMBOS_SUBITENS[nome]) {
        "(NOBRIDGE) LOG Revertendo estoque para combo:", nome;
        const subItens = COMBOS_SUBITENS[nome];
        for (const subItem of subItens) {
          const { nome: subItemNome, quantidade: subItemQuantidade } = subItem;
          const quantidadeTotal = subItemQuantidade * (quantidade || 1);

          const estoqueSnapshot = await db
            .ref(`estoque/${subItemNome}`)
            .once("value");
          const estoqueData = estoqueSnapshot.val();

          const quantidadeAtual = estoqueData ? estoqueData.quantidade || 0 : 0;
          const novaQuantidade = quantidadeAtual + quantidadeTotal;

          await db
            .ref(`estoque/${subItemNome}`)
            .update({ quantidade: novaQuantidade });
          "(NOBRIDGE) LOG Estoque revertido para subitem:",
            {
              nome: subItemNome,
              novaQuantidade,
            };
        }
      } else {
        "(NOBRIDGE) LOG Revertendo estoque para item:",
          {
            nome,
            quantidade,
          };

        const estoqueSnapshot = await db.ref(`estoque/${nome}`).once("value");
        const estoqueData = estoqueSnapshot.val();

        const quantidadeAtual = estoqueData ? estoqueData.quantidade || 0 : 0;
        const novaQuantidade = quantidadeAtual + quantidade;

        await db.ref(`estoque/${nome}`).update({ quantidade: novaQuantidade });
        "(NOBRIDGE) LOG Estoque revertido:",
          {
            nome,
            novaQuantidade,
          };
      }
    }

    await db.ref(`pedidos/${pedidoId}`).remove();
    "(NOBRIDGE) LOG Pedido removido após reversão:", pedidoId;
  } catch (error) {
    console.error(
      "(NOBRIDGE) ERROR Erro ao reverter estoque do pedido:",
      error
    );
    throw error;
  }
};

export const adicionarNovoItemCardapio = async (
  nome,
  precoUnitario,
  imagemUrl,
  categoria,
  chaveUnica,
  descricao = ""
) => {
  const db = await ensureFirebaseInitialized();
  try {
    "(NOBRIDGE) LOG Iniciando adição ao cardápio:",
      {
        nome,
        precoUnitario,
        imagemUrl,
        categoria,
        chaveUnica,
        descricao,
      };

    const itemData = {
      nome,
      precoUnitario: parseFloat(precoUnitario) || 0,
      descrição: descricao || "Sem descrição",
      imagens: imagemUrl ? [imagemUrl] : [],
    };

    await db.ref(`cardapio/${categoria}/${chaveUnica}`).set(itemData);
    "(NOBRIDGE) LOG Item adicionado ao cardápio com sucesso:", itemData;
  } catch (error) {
    console.error("(NOBRIDGE) ERROR Detalhes do erro no cardápio:", {
      message: error.message,
      code: error.code,
    });
    throw error;
  }
};

export const removerItemEstoqueECardapio = async (nomeItem, categoria) => {
  const db = await ensureFirebaseInitialized();
  try {
    const snapshot = await db
      .ref(`estoque/${nomeItem}/chaveCardapio`)
      .once("value");
    const chaveCardapio = snapshot.val();

    if (chaveCardapio) {
      await db.ref(`cardapio/${categoria}/${chaveCardapio}`).remove();
      `(NOBRIDGE) LOG Item ${nomeItem} removido do cardápio`;
    } else {
      `(NOBRIDGE) LOG Nenhuma entrada no cardápio encontrada para ${nomeItem}`;
    }

    await db.ref(`estoque/${nomeItem}`).remove();
    `(NOBRIDGE) LOG Item ${nomeItem} removido do estoque`;
  } catch (error) {
    console.error("(NOBRIDGE) ERROR Erro ao remover item:", {
      message: error.message,
      code: error.code,
    });
    throw error;
  }
};

export const atualizarQuantidadeEstoque = async (
  nomeItem,
  novaQuantidade,
  categoria
) => {
  const db = await ensureFirebaseInitialized();
  try {
    await db
      .ref(`estoque/${nomeItem}/quantidade`)
      .set(parseInt(novaQuantidade, 10));
    `(NOBRIDGE) LOG Quantidade de ${nomeItem} atualizada para ${novaQuantidade}`;

    if (parseInt(novaQuantidade, 10) <= 0) {
      const snapshot = await db
        .ref(`estoque/${nomeItem}/chaveCardapio`)
        .once("value");
      const chaveCardapio = snapshot.val();

      if (chaveCardapio) {
        await db.ref(`cardapio/${categoria}/${chaveCardapio}`).remove();
        `(NOBRIDGE) LOG Item ${nomeItem} removido do cardápio por quantidade zero`;
      }

      await db.ref(`estoque/${nomeItem}`).remove();
      `(NOBRIDGE) LOG Item ${nomeItem} removido do estoque por quantidade zero`;
    }
  } catch (error) {
    console.error("(NOBRIDGE) ERROR Erro ao atualizar quantidade:", {
      message: error.message,
      code: error.code,
    });
    throw error;
  }
};

export const adicionarFichaTecnica = async (
  itemCardapio,
  itemEstoque,
  quantidadePorUnidade
) => {
  const freshDb = await ensureFirebaseInitialized();
  await waitForConnection(freshDb);
  try {
    "(NOBRIDGE) LOG Iniciando adição de ficha técnica:",
      {
        itemCardapio,
        itemEstoque,
        quantidadePorUnidade,
      };
    const ref = freshDb.ref(`fichasTecnicas/${itemCardapio}`);
    const snapshot = await ref.once("value");
    const fichaExistente = snapshot.val() || {};

    const fichaData = {
      ...fichaExistente,
      [itemEstoque]: parseFloat(quantidadePorUnidade) || 1,
    };

    await ref.set(fichaData);
    "(NOBRIDGE) LOG Ficha técnica adicionada com sucesso:", fichaData;
  } catch (error) {
    console.error("(NOBRIDGE) ERROR Falha ao adicionar ficha técnica:", error);
    throw error;
  }
};

export const fecharMesa = async (mesaId, updates) => {
  const freshDb = await ensureFirebaseInitialized();
  await waitForConnection(freshDb);
  try {
    "(NOBRIDGE) LOG Atualizando mesa para fechamento ou pagamento parcial:",
      { mesaId, updates };
    const ref = freshDb.ref(`mesas/${mesaId}`);
    const snapshot = await ref.once("value");
    if (!snapshot.exists()) {
      throw new Error(`Mesa ${mesaId} não encontrada.`);
    }
    await ref.update(updates);
    "(NOBRIDGE) LOG Mesa atualizada com sucesso para fechamento ou pagamento:",
      mesaId;
  } catch (error) {
    console.error(
      "(NOBRIDGE) ERROR Erro ao atualizar mesa para fechamento ou pagamento:",
      error
    );
    throw error;
  }
};

export const enviarComandaViaWhatsApp = async (
  mesaId,
  pedidos,
  cardapio,
  telefone
) => {
  try {
    "(NOBRIDGE) LOG Gerando texto da comanda para WhatsApp:",
      {
        mesaId,
        pedidos,
        cardapio,
        telefone,
      };

    const mesaSnapshot = await firebase
      .database()
      .ref(`mesas/${mesaId}`)
      .once("value");

    const mesa = mesaSnapshot.val();
    if (!mesa) {
      console.warn("(NOBRIDGE) WARN Mesa não encontrada:", mesaId);
      throw new Error("Mesa não encontrada.");
    }
    const nomeMesa = mesa.nomeCliente || `Mesa ${mesaId}`;

    let texto = `Conta da ${nomeMesa}\nItens:\n`;
    pedidos.forEach((pedido) => {
      if (pedido.itens && Array.isArray(pedido.itens)) {
        pedido.itens.forEach((item) => {
          const itemCardapio = cardapio.find((c) => c.nome === item.nome);
          const precoUnitario = itemCardapio ? itemCardapio.precoUnitario : 0;
          texto += `${item.nome} x${
            item.quantidade
          } - R$ ${precoUnitario.toFixed(2)} cada - R$ ${(
            item.quantidade * precoUnitario
          ).toFixed(2)}\n`;
        });
      }
    });

    const total = pedidos.reduce((acc, pedido) => {
      if (pedido.itens && Array.isArray(pedido.itens)) {
        const pedidoTotal = pedido.itens.reduce((sum, item) => {
          const itemCardapio = cardapio.find((c) => c.nome === item.nome);
          const precoUnitario = itemCardapio ? itemCardapio.precoUnitario : 0;
          return sum + item.quantidade * precoUnitario;
        }, 0);
        return acc + pedidoTotal;
      }
      return acc;
    }, 0);

    texto += `\nTotal: R$ ${total.toFixed(2)}`;

    "(NOBRIDGE) LOG Texto da comanda gerado com sucesso:", texto;

    const numeroLimpo = telefone.replace(/[^\d+]/g, "");
    const encodedText = encodeURIComponent(texto);
    const whatsappUrl = `whatsapp://send?phone=${numeroLimpo}&text=${encodedText}`;

    "(NOBRIDGE) LOG URL do WhatsApp gerada:", whatsappUrl;
    return whatsappUrl;
  } catch (error) {
    console.error(
      "(NOBRIDGE) ERROR Erro ao gerar texto da comanda para WhatsApp:",
      error
    );
    throw error;
  }
};

export const removerMesa = async (mesaId) => {
  const freshDb = await ensureFirebaseInitialized();
  try {
    "(NOBRIDGE) LOG Verificando conexão antes de remover mesa:", mesaId;
    const connectedRef = freshDb.ref(".info/connected");
    const isConnected = await new Promise((resolve) => {
      connectedRef.once("value", (snapshot) => {
        resolve(snapshot.val() === true);
      });
    });
    if (!isConnected) {
      freshDb.goOnline();
      await waitForConnection(freshDb);
    }
    "(NOBRIDGE) LOG Conexão confirmada, removendo mesa:", mesaId;
    const ref = freshDb.ref(`mesas/${mesaId}`);
    await ref.remove();
    "(NOBRIDGE) LOG Mesa removida com sucesso do Firebase:", mesaId;
  } catch (error) {
    console.error("(NOBRIDGE) ERROR Erro ao remover mesa do Firebase:", error);
    throw error;
  }
};

export const removerPedidosDaMesa = async (mesaId) => {
  const freshDb = await ensureFirebaseInitialized();
  try {
    "(NOBRIDGE) LOG Removendo pedidos da mesa:", mesaId;
    const pedidosSnapshot = await freshDb.ref("pedidos").once("value");
    const todosPedidos = pedidosSnapshot.val() || {};
    const pedidosDaMesa = Object.entries(todosPedidos)
      .filter(([_, pedido]) => pedido.mesa === mesaId)
      .map(([id]) => id);

    const updates = {};
    pedidosDaMesa.forEach((pedidoId) => {
      updates[`pedidos/${pedidoId}`] = null;
    });

    if (Object.keys(updates).length > 0) {
      await freshDb.ref().update(updates);
      "(NOBRIDGE) LOG Pedidos removidos com sucesso da mesa:", mesaId;
    } else {
      "(NOBRIDGE) LOG Nenhum pedido encontrado para a mesa:", mesaId;
    }
  } catch (error) {
    console.error("(NOBRIDGE) ERROR Erro ao remover pedidos da mesa:", error);
    throw error;
  }
};
