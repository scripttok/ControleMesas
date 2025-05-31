import firebase from "firebase/compat/app";
import "firebase/compat/database";
import { waitForFirebaseInit, waitForConnection } from "./firebase";

// controle\src\services\mesaService.js
export const adicionarMesaNoFirebase = async (mesa) => {
  console.log(
    "(NOBRIDGE) LOG adicionarMesaNoFirebase - Iniciando adição de mesa:",
    mesa
  );
  try {
    const freshDb = await waitForFirebaseInit();
    console.log(
      "(NOBRIDGE) LOG adicionarMesaNoFirebase - Firebase inicializado:",
      !!freshDb
    );
    if (!freshDb) {
      throw new Error("Firebase não inicializado corretamente");
    }
    console.log(
      "(NOBRIDGE) LOG adicionarMesaNoFirebase - Verificando waitForConnection"
    );
    await waitForConnection(freshDb);
    console.log(
      "(NOBRIDGE) LOG adicionarMesaNoFirebase - Conexão estabelecida"
    );
    console.log(
      "(NOBRIDGE) LOG adicionarMesaNoFirebase - firebase.database.ServerValue:",
      firebase.database.ServerValue
    );
    const dataToSend = {
      ...mesa,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
    };
    console.log(
      "(NOBRIDGE) LOG adicionarMesaNoFirebase - Dados a serem enviados:",
      dataToSend
    );
    const newMesaRef = await freshDb.ref("mesas").push(dataToSend);
    console.log(
      "(NOBRIDGE) LOG adicionarMesaNoFirebase - Mesa adicionada, key:",
      newMesaRef.key
    );
    return newMesaRef.key;
  } catch (error) {
    console.error("(NOBRIDGE) ERROR adicionarMesaNoFirebase - Erro:", error);
    throw error;
  }
};

export const getMesas = (callback) => {
  let ref;
  const setupListener = async () => {
    const freshDb = await waitForFirebaseInit();
    if (!freshDb) {
      console.error("Firebase DB não inicializado em getMesas");
      callback([]);
      return;
    }
    ref = freshDb.ref("mesas");
    let initialLoad = false;

    // Carrega o snapshot inicial
    ref.on(
      "value",
      (snapshot) => {
        const data = snapshot.val();
        console.log("Mesas recebidas (value):", data);
        const mesas = data
          ? Object.entries(data).map(([id, value]) => ({
              id,
              ...value,
              nomeCliente: value.nomeCliente || `Mesa ${id}`,
            }))
          : [];
        callback(mesas);
        initialLoad = true;
      },
      (error) => {
        console.error("Erro em getMesas (value):", error);
        callback([]);
      }
    );

    // Escuta novas mesas adicionadas
    ref.on(
      "child_added",
      (snapshot) => {
        if (initialLoad) {
          const newMesa = {
            id: snapshot.key,
            ...snapshot.val(),
            nomeCliente: snapshot.val().nomeCliente || `Mesa ${snapshot.key}`,
          };
          console.log("Nova mesa adicionada (child_added):", newMesa);
          callback((prevMesas) => {
            // Evita duplicação se a mesa já está no estado
            if (prevMesas.some((m) => m.id === newMesa.id)) {
              return prevMesas;
            }
            return [...prevMesas, newMesa];
          });
        }
      },
      (error) => {
        console.error("Erro em getMesas (child_added):", error);
      }
    );
  };
  setupListener();
  return () => {
    if (ref) {
      console.log("Desmontando listeners de mesas");
      ref.off("value");
      ref.off("child_added");
    }
  };
};

export const getPedidos = (callback) => {
  let ref;
  const setupListener = async () => {
    const freshDb = await waitForFirebaseInit();
    if (!freshDb) {
      console.error("Firebase DB não inicializado em getPedidos");
      callback([]);
      return;
    }
    ref = freshDb.ref("pedidos");
    ref.on(
      "value",
      (snapshot) => {
        const data = snapshot.val();
        console.log("Pedidos recebidos:", data);
        callback(
          data
            ? Object.entries(data).map(([id, value]) => ({ id, ...value }))
            : []
        );
      },
      (error) => {
        console.error("Erro em getPedidos:", error);
        callback([]);
      }
    );
  };
  setupListener();
  return () => {
    if (ref) {
      console.log("Desmontando listener de pedidos");
      ref.off("value");
    }
  };
};

export const atualizarMesa = async (mesaId, updates) => {
  const freshDb = await waitForFirebaseInit();
  await waitForConnection(freshDb);
  if (!freshDb) {
    console.error("Firebase DB não inicializado em atualizarMesa");
    throw new Error("Firebase DB não inicializado.");
  }
  try {
    const ref = freshDb.ref(`mesas/${mesaId}`);
    if (!ref) {
      console.error("Referência inválida para mesa:", mesaId);
      throw new Error("Referência ao Firebase inválida.");
    }
    if (updates === null) {
      console.log("Removendo mesa:", mesaId);
      await ref.remove();
    } else {
      console.log("Atualizando mesa:", mesaId, updates);
      await ref.update(updates);
    }
    console.log("Mesa atualizada com sucesso:", mesaId);
  } catch (error) {
    console.error("Erro ao atualizar/remover mesa:", error);
    throw error;
  }
};

export const juntarMesas = async (mesaIds) => {
  if (mesaIds.length < 2) {
    throw new Error("É necessário pelo menos duas mesas para juntar.");
  }

  const freshDb = await waitForFirebaseInit();
  await waitForConnection(freshDb);
  try {
    const mesas = await Promise.all(
      mesaIds.map(async (id) => {
        const ref = freshDb.ref(`mesas/${id}`);
        const snapshot = await ref.once("value");
        const mesa = snapshot.val();
        if (!mesa) throw new Error(`Mesa ${id} não encontrada.`);
        return { id, ...mesa };
      })
    );

    for (const mesa of mesas) {
      if (mesa.status === "fechada") {
        throw new Error("Não é possível juntar mesa fechada.");
      }
      if (!mesa.nomeCliente) {
        mesa.nomeCliente = `Mesa ${mesa.id}`;
      }
    }

    const pedidosSnapshot = await freshDb.ref("pedidos").once("value");
    const todosPedidos = pedidosSnapshot.val() || {};
    const pedidosCombinados = mesaIds.flatMap((mesaId) =>
      Object.entries(todosPedidos)
        .filter(([_, pedido]) => pedido.mesa === mesaId)
        .map(([id, pedido]) => ({
          id,
          ...pedido,
          mesaOriginal: pedido.mesaOriginal || mesaId,
        }))
    );

    const valorTotal = pedidosCombinados.reduce((sum, pedido) => {
      const pedidoTotal =
        pedido.itens?.reduce(
          (subSum, item) =>
            subSum + (item.quantidade * item.precoUnitario || 0),
          0
        ) || 0;
      return sum + pedidoTotal;
    }, 0);
    const valorPago = mesas.reduce(
      (sum, m) => sum + (parseFloat(m.valorPago) || 0),
      0
    );
    const valorRestante = valorTotal - valorPago;

    const novoNomeCliente = mesas.map((m) => m.nomeCliente).join(" & ");
    const novaMesa = {
      nomeCliente: novoNomeCliente,
      posX: mesas[0].posX || 0,
      posY: mesas[0].posY || 0,
      status: "aberta",
      createdAt: mesas[0].createdAt,
      valorTotal,
      valorPago,
      valorRestante,
      historicoPagamentos: mesas.flatMap((m) => m.historicoPagamentos || []),
    };

    const mesasOriginais = mesas.reduce((acc, mesa) => {
      acc[mesa.id] = { ...mesa };
      return acc;
    }, {});
    const juntadaId = mesaIds[0];
    await freshDb.ref(`mesasJuntadas/${juntadaId}`).set(mesasOriginais);

    const updates = {};
    pedidosCombinados.forEach((pedido) => {
      updates[`pedidos/${pedido.id}/mesa`] = mesaIds[0];
      updates[`pedidos/${pedido.id}/mesaOriginal`] = pedido.mesaOriginal;
    });
    updates[`mesas/${mesaIds[0]}`] = novaMesa;
    mesaIds.slice(1).forEach((id) => {
      updates[`mesas/${id}`] = null;
    });

    await freshDb.ref().update(updates);
  } catch (error) {
    console.error("Erro ao juntar mesas:", error);
    throw error;
  }
};

export const adicionarPedido = async (mesaId, itens) => {
  console.log("adicionarPedido - Iniciando para mesaId:", mesaId);
  console.log("adicionarPedido - Itens recebidos:", itens);
  const freshDb = await waitForFirebaseInit();
  await waitForConnection(freshDb);
  try {
    const itensValidos = itens.filter((item) => {
      const isValid =
        item.quantidade > 0 && item.nome && typeof item.nome === "string";
      console.log("adicionarPedido - Validando item:", { item, isValid });
      return isValid;
    });
    console.log("adicionarPedido - Itens válidos:", itensValidos);

    if (itensValidos.length === 0) {
      console.log("adicionarPedido - Nenhum item válido encontrado");
      throw new Error("Nenhum item válido para adicionar ao pedido.");
    }

    const cardapioSnapshot = await freshDb.ref("cardapio").once("value");
    const cardapioData = cardapioSnapshot.val() || {};
    const cardapio = [];
    Object.entries(cardapioData).forEach(([categoria, subItens]) => {
      Object.values(subItens).forEach((item) => {
        cardapio.push({
          nome: item.nome,
          precoUnitario: item.precoUnitario || 0,
        });
      });
    });

    const pedido = {
      mesa: mesaId,
      itens: itensValidos.map((item) => {
        const cardapioItem = cardapio.find((c) => c.nome === item.nome);
        return {
          nome: item.nome,
          quantidade: item.quantidade,
          precoUnitario: cardapioItem ? cardapioItem.precoUnitario : 0,
          observacao: item.observacao || "",
        };
      }),
      status: "aguardando",
      entregue: false,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
    };
    console.log("adicionarPedido - Pedido preparado:", pedido);

    const pedidoId = await freshDb.ref("pedidos").push(pedido).key;
    console.log("adicionarPedido - Pedido adicionado com sucesso:", pedidoId);
    return pedidoId;
  } catch (error) {
    console.error("adicionarPedido - Erro:", error);
    throw error;
  }
};

export const getEstoque = (callback) => {
  let ref;
  const setupListener = async () => {
    const freshDb = await waitForFirebaseInit();
    ref = freshDb.ref("estoque");
    ref.on(
      "value",
      (snapshot) => {
        const data = snapshot.val();
        console.log("Estoque recebido:", data);
        callback(
          data
            ? Object.entries(data).map(([id, value]) => ({ id, ...value }))
            : []
        );
      },
      (error) => {
        console.error("Erro em getEstoque:", error);
        callback([]);
      }
    );
  };
  setupListener();
  return () => {
    if (ref) {
      console.log("Desmontando listener de estoque");
      ref.off("value");
    }
  };
};

export const getCardapio = (callback) => {
  let ref;
  const setupListener = async () => {
    const freshDb = await waitForFirebaseInit();
    ref = freshDb.ref("cardapio");
    ref.on(
      "value",
      (snapshot) => {
        const data = snapshot.val();
        console.log("Cardápio recebido em mesaService:", data);
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
        console.error("Erro em getCardapio:", error);
        callback([]);
      }
    );
  };
  setupListener();
  return () => {
    if (ref) {
      console.log("Desmontando listener de cardápio");
      ref.off("value");
    }
  };
};

export const removerPedidoDoFirebase = async (pedidoId) => {
  const db = await waitForFirebaseInit();
  return db.ref(`historicoPedidos/${pedidoId}`).remove();
};

export const removerPedidoDoHistorico = async (pedidoId) => {
  try {
    const db = await waitForFirebaseInit();
    await db.ref(`historicoPedidos/${pedidoId}`).remove();
    console.log(`Pedido ${pedidoId} removido com sucesso`);
    return true;
  } catch (error) {
    console.error("Erro ao remover pedido:", error);
    throw error;
  }
};

export const salvarHistoricoPedido = async (dadosPedido) => {
  const freshDb = await waitForFirebaseInit();
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

    console.log(
      "Histórico salvo com ID:",
      novoHistoricoRef.key,
      "Dados:",
      novoHistorico
    );
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
      const freshDb = await waitForFirebaseInit();
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
  "Vodka Smirniff Cg Coco E Red Bull": [
    { nome: "gelo de coco", quantidade: 1 },
    { nome: "redbull", quantidade: 1 },
  ],
  "Ballantines Ou White Horse Cg Coco E Red Bull": [
    { nome: "gelo de coco", quantidade: 1 },
    { nome: "redbull", quantidade: 1 },
  ],
  "Red Label Com Gelo Coco E Red Bull": [
    { nome: "gelo de coco", quantidade: 1 },
    { nome: "redbull", quantidade: 1 },
  ],
  "Whisky 12 Anos Com Gelo Coco E Red Bull": [
    { nome: "gelo de coco", quantidade: 1 },
    { nome: "redbull", quantidade: 1 },
  ],
  "1 Litro Whisky Ballantines Ou W Horse + 4 Red Bull + 4 G Coco": [
    { nome: "gelo de coco", quantidade: 4 },
    { nome: "redbull", quantidade: 4 },
  ],
  "1 Litro Whisky Red Label  + 4 Red Bull + 4 G Coco": [
    { nome: "gelo de coco", quantidade: 4 },
    { nome: "redbull", quantidade: 4 },
  ],
  "1 Litro Whisky Black Label  + 4 Red Bull + 4 G Coco": [
    { nome: "gelo de coco", quantidade: 4 },
    { nome: "redbull", quantidade: 4 },
  ],
};

export const atualizarStatusPedido = async (pedidoId, novoStatus) => {
  const db = await waitForFirebaseInit();
  try {
    console.log("atualizarStatusPedido - Iniciando:", { pedidoId, novoStatus });
    await db.ref(`pedidos/${pedidoId}`).update({ entregue: novoStatus });

    if (novoStatus === true) {
      console.log(
        "atualizarStatusPedido - Pedido marcado como entregue, buscando dados"
      );
      const pedidoSnapshot = await db.ref(`pedidos/${pedidoId}`).once("value");
      const pedido = pedidoSnapshot.val();
      console.log("atualizarStatusPedido - Dados do pedido:", pedido);

      if (!pedido || !pedido.itens) {
        console.warn(
          "atualizarStatusPedido - Pedido ou itens não encontrados:",
          pedidoId
        );
        return;
      }

      for (const item of pedido.itens) {
        console.log("atualizarStatusPedido - Processando item:", item);
        const { nome, quantidade } = item;

        if (!nome) {
          console.warn(
            "atualizarStatusPedido - Item sem nome, ignorando:",
            item
          );
          continue;
        }

        if (COMBOS_SUBITENS[nome]) {
          console.log("atualizarStatusPedido - Combo identificado:", {
            nome,
            subItens: COMBOS_SUBITENS[nome],
          });
          const subItens = COMBOS_SUBITENS[nome];

          for (const subItem of subItens) {
            const { nome: subItemNome, quantidade: subItemQuantidade } =
              subItem;
            if (!subItemNome) {
              console.warn(
                "atualizarStatusPedido - Subitem sem nome, ignorando:",
                subItem
              );
              continue;
            }

            const quantidadeTotal = subItemQuantidade * (quantidade || 1);
            console.log(
              "atualizarStatusPedido - Baixando estoque para subitem:",
              { subItemNome, quantidadeTotal, quantidadeItem: quantidade }
            );

            const estoqueSnapshot = await db
              .ref(`estoque/${subItemNome.toLowerCase()}`)
              .once("value");
            const estoqueData = estoqueSnapshot.val();
            console.log("atualizarStatusPedido - Estoque atual:", {
              subItemNome,
              estoqueData,
            });

            if (estoqueData) {
              const quantidadeAtual = estoqueData.quantidade || 0;
              const novaQuantidade = Math.max(
                quantidadeAtual - quantidadeTotal,
                0
              );
              console.log(
                "atualizarStatusPedido - Nova quantidade calculada:",
                { subItemNome, quantidadeAtual, novaQuantidade }
              );

              if (novaQuantidade > 0) {
                await db
                  .ref(`estoque/${subItemNome.toLowerCase()}`)
                  .update({ quantidade: novaQuantidade });
                console.log("atualizarStatusPedido - Estoque atualizado:", {
                  subItemNome,
                  novaQuantidade,
                });
              } else {
                await db.ref(`estoque/${subItemNome.toLowerCase()}`).remove();
                console.log(
                  "atualizarStatusPedido - Subitem removido do estoque:",
                  subItemNome
                );
                if (estoqueData.chaveCardapio && estoqueData.categoria) {
                  await db
                    .ref(
                      `cardapio/${estoqueData.categoria}/${estoqueData.chaveCardapio}`
                    )
                    .remove();
                  console.log(
                    "atualizarStatusPedido - Subitem removido do cardápio:",
                    subItemNome
                  );
                }
              }
            } else {
              console.warn(
                "atualizarStatusPedido - Subitem não encontrado no estoque:",
                subItemNome
              );
            }
          }
        } else {
          console.log("atualizarStatusPedido - Item não-combo:", {
            nome,
            quantidade,
          });

          const estoqueSnapshot = await db
            .ref(`estoque/${nome.toLowerCase()}`)
            .once("value");
          const estoqueData = estoqueSnapshot.val();

          if (estoqueData) {
            const quantidadeAtual = estoqueData.quantidade || 0;
            const novaQuantidade = Math.max(quantidadeAtual - quantidade, 0);

            if (novaQuantidade > 0) {
              await db
                .ref(`estoque/${nome.toLowerCase()}`)
                .update({ quantidade: novaQuantidade });
              console.log("atualizarStatusPedido - Estoque atualizado:", {
                nome,
                novaQuantidade,
              });
            } else {
              await db.ref(`estoque/${nome.toLowerCase()}`).remove();
              console.log(
                "atualizarStatusPedido - Item removido do estoque:",
                nome
              );
              if (estoqueData.chaveCardapio && estoqueData.categoria) {
                await db
                  .ref(
                    `cardapio/${estoqueData.categoria}/${estoqueData.chaveCardapio}`
                  )
                  .remove();
                console.log(
                  "atualizarStatusPedido - Item removido do cardápio:",
                  nome
                );
              }
            }
          } else {
            console.warn(
              "atualizarStatusPedido - Item não encontrado no estoque:",
              nome
            );
          }
        }
      }
    }

    console.log("atualizarStatusPedido - Status atualizado com sucesso:", {
      pedidoId,
      novoStatus,
    });
  } catch (error) {
    console.error("atualizarStatusPedido - Erro:", error);
    throw error;
  }
};

export const validarEstoqueParaPedido = async (itens) => {
  const db = await waitForFirebaseInit();
  try {
    for (const item of itens) {
      const { nome, quantidade } = item;
      console.log("Validando item:", { nome, quantidade });

      if (COMBOS_SUBITENS[nome]) {
        const subItens = COMBOS_SUBITENS[nome];
        console.log("Subitens do combo:", subItens);
        for (const subItem of subItens) {
          const { nome: subItemNome, quantidade: subItemQuantidade } = subItem;
          const quantidadeTotal = subItemQuantidade * (quantidade || 1);
          console.log("Verificando subitem:", { subItemNome, quantidadeTotal });

          const estoqueSnapshot = await db
            .ref(`estoque/${subItemNome.toLowerCase()}`)
            .once("value");
          const estoqueData = estoqueSnapshot.val();
          console.log("Estoque encontrado:", { subItemNome, estoqueData });

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
        const estoqueSnapshot = await db
          .ref(`estoque/${nome.toLowerCase()}`)
          .once("value");
        const estoqueData = estoqueSnapshot.val();
        console.log("Estoque encontrado:", { nome, estoqueData });

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
    console.error("Erro ao validar estoque:", error);
    throw error;
  }
};

export const adicionarNovoItemEstoque = async (
  nome,
  quantidade,
  unidade = "unidades",
  estoqueMinimo = 0
) => {
  console.log("adicionarNovoItemEstoque - Iniciando:", {
    nome,
    quantidade,
    unidade,
    estoqueMinimo,
  });

  if (!nome || typeof nome !== "string") {
    console.error("adicionarNovoItemEstoque - Nome inválido:", nome);
    throw new Error("Nome do item é obrigatório e deve ser uma string.");
  }

  const freshDb = await waitForFirebaseInit();
  await waitForConnection(freshDb);
  try {
    const ref = freshDb.ref(`estoque/${nome.toLowerCase()}`);
    const snapshot = await ref.once("value");
    const itemExistente = snapshot.val();

    const novaQuantidade = itemExistente
      ? (itemExistente.quantidade || 0) + parseFloat(quantidade)
      : parseFloat(quantidade);

    const itemData = {
      nome: nome.toLowerCase(),
      quantidade: novaQuantidade,
      unidade: unidade || (itemExistente ? itemExistente.unidade : "unidades"),
      estoqueMinimo:
        parseFloat(estoqueMinimo) ||
        (itemExistente ? itemExistente.estoqueMinimo : 0),
    };

    console.log(
      "adicionarNovoItemEstoque - Dados do item preparados:",
      itemData
    );
    await ref.set(itemData);
    console.log(
      "adicionarNovoItemEstoque - Item adicionado ao estoque:",
      itemData
    );
  } catch (error) {
    console.error(
      "adicionarNovoItemEstoque - Falha ao adicionar ao estoque:",
      error
    );
    throw error;
  }
};

export const removerEstoque = async (itemId, quantidade) => {
  const freshDb = await waitForFirebaseInit();
  await waitForConnection(freshDb);
  try {
    console.log("Tentando remover do estoque:", { itemId, quantidade });
    const ref = freshDb.ref(`estoque/${itemId.toLowerCase()}`);
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
    console.log("Item removido do estoque com sucesso:", itemData);
  } catch (error) {
    console.error("Erro ao remover do estoque:", error);
    throw error;
  }
};

export const reverterEstoquePedido = async (pedidoId) => {
  const db = await waitForFirebaseInit();
  try {
    console.log("Revertendo estoque do pedido:", pedidoId);
    const pedidoSnapshot = await db.ref(`pedidos/${pedidoId}`).once("value");
    const pedido = pedidoSnapshot.val();

    if (!pedido || !pedido.entregue) {
      console.warn("Pedido não encontrado ou não entregue:", pedidoId);
      return;
    }

    const itens = pedido.itens || [];
    for (const item of itens) {
      const { nome, quantidade } = item;

      if (COMBOS_SUBITENS[nome]) {
        console.log("Revertendo estoque para combo:", nome);
        const subItens = COMBOS_SUBITENS[nome];
        for (const subItem of subItens) {
          const { nome: subItemNome, quantidade: subItemQuantidade } = subItem;
          const quantidadeTotal = subItemQuantidade * (quantidade || 1);

          const estoqueSnapshot = await db
            .ref(`estoque/${subItemNome.toLowerCase()}`)
            .once("value");
          const estoqueData = estoqueSnapshot.val();

          const quantidadeAtual = estoqueData ? estoqueData.quantidade || 0 : 0;
          const novaQuantidade = quantidadeAtual + quantidadeTotal;

          await db
            .ref(`estoque/${subItemNome.toLowerCase()}`)
            .update({ quantidade: novaQuantidade });
          console.log("Estoque revertido para subitem:", {
            nome: subItemNome,
            novaQuantidade,
          });
        }
      } else {
        console.log("Revertendo estoque para item:", { nome, quantidade });

        const estoqueSnapshot = await db
          .ref(`estoque/${nome.toLowerCase()}`)
          .once("value");
        const estoqueData = estoqueSnapshot.val();

        const quantidadeAtual = estoqueData ? estoqueData.quantidade || 0 : 0;
        const novaQuantidade = quantidadeAtual + quantidade;

        await db
          .ref(`estoque/${nome.toLowerCase()}`)
          .update({ quantidade: novaQuantidade });
        console.log("Estoque revertido:", { nome, novaQuantidade });
      }
    }

    await db.ref(`pedidos/${pedidoId}`).remove();
    console.log("Pedido removido após reversão:", pedidoId);
  } catch (error) {
    console.error("Erro ao reverter estoque do pedido:", error);
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
  const db = await waitForFirebaseInit();
  try {
    console.log("Iniciando adição ao cardápio:", {
      nome,
      precoUnitario,
      imagemUrl,
      categoria,
      chaveUnica,
      descricao,
    });

    const itemData = {
      nome: nome.toLowerCase(),
      precoUnitario: parseFloat(precoUnitario) || 0,
      descrição: descricao || "Sem descrição",
      imagens: imagemUrl ? [imagemUrl] : [],
    };

    await db.ref(`cardapio/${categoria}/${chaveUnica}`).set(itemData);
    console.log("Item adicionado ao cardápio com sucesso:", itemData);
  } catch (error) {
    console.error("Detalhes do erro no cardápio:", {
      message: error.message,
      code: error.code,
    });
    throw error;
  }
};

export const removerItemEstoqueECardapio = async (nomeItem, categoria) => {
  const db = await waitForFirebaseInit();
  try {
    const snapshot = await db
      .ref(`estoque/${nomeItem.toLowerCase()}/chaveCardapio`)
      .once("value");
    const chaveCardapio = snapshot.val();

    if (chaveCardapio) {
      await db.ref(`cardapio/${categoria}/${chaveCardapio}`).remove();
      console.log(`Item ${nomeItem} removido do cardápio`);
    } else {
      console.log(`Nenhuma entrada no cardápio encontrada para ${nomeItem}`);
    }

    await db.ref(`estoque/${nomeItem.toLowerCase()}`).remove();
    console.log(`Item ${nomeItem} removido do estoque`);
  } catch (error) {
    console.error("Erro ao remover item:", {
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
  const db = await waitForFirebaseInit();
  try {
    await db
      .ref(`estoque/${nomeItem.toLowerCase()}/quantidade`)
      .set(parseInt(novaQuantidade, 10));
    console.log(`Quantidade de ${nomeItem} atualizada para ${novaQuantidade}`);

    if (parseInt(novaQuantidade, 10) <= 0) {
      const snapshot = await db
        .ref(`estoque/${nomeItem.toLowerCase()}/chaveCardapio`)
        .once("value");
      const chaveCardapio = snapshot.val();

      if (chaveCardapio) {
        await db.ref(`cardapio/${categoria}/${chaveCardapio}`).remove();
        console.log(
          `Item ${nomeItem} removido do cardápio por quantidade zero`
        );
      }

      await db.ref(`estoque/${nomeItem.toLowerCase()}`).remove();
      console.log(`Item ${nomeItem} removido do estoque por quantidade zero`);
    }
  } catch (error) {
    console.error("Erro ao atualizar quantidade:", {
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
  const freshDb = await waitForFirebaseInit();
  await waitForConnection(freshDb);
  try {
    console.log("Iniciando adição de ficha técnica:", {
      itemCardapio,
      itemEstoque,
      quantidadePorUnidade,
    });
    const ref = freshDb.ref(`fichasTecnicas/${itemCardapio.toLowerCase()}`);
    const snapshot = await ref.once("value");
    const fichaExistente = snapshot.val() || {};

    const fichaData = {
      ...fichaExistente,
      [itemEstoque.toLowerCase()]: parseFloat(quantidadePorUnidade) || 1,
    };

    await ref.set(fichaData);
    console.log("Ficha técnica adicionada com sucesso:", fichaData);
  } catch (error) {
    console.error("Falha ao adicionar ficha técnica:", error);
    throw error;
  }
};

export const fecharMesa = async (mesaId, updates) => {
  const freshDb = await waitForFirebaseInit();
  await waitForConnection(freshDb);
  try {
    console.log("Atualizando mesa para fechamento ou pagamento parcial:", {
      mesaId,
      updates,
    });
    const ref = freshDb.ref(`mesas/${mesaId}`);
    const snapshot = await ref.once("value");
    if (!snapshot.exists()) {
      throw new Error(`Mesa ${mesaId} não encontrada.`);
    }
    await ref.update(updates);
    console.log(
      "Mesa atualizada com sucesso para fechamento ou pagamento:",
      mesaId
    );
  } catch (error) {
    console.error(
      "Erro ao atualizar mesa para fechamento ou pagamento:",
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
    console.log("Gerando texto da comanda para WhatsApp:", {
      mesaId,
      pedidos,
      cardapio,
      telefone,
    });

    const mesaSnapshot = await firebase
      .database()
      .ref(`mesas/${mesaId}`)
      .once("value");

    const mesa = mesaSnapshot.val();
    if (!mesa) {
      console.warn("Mesa não encontrada:", mesaId);
      throw new Error("Mesa não encontrada.");
    }
    const nomeMesa = mesa.nomeCliente || `Mesa ${mesaId}`;

    let texto = `🍽️ Olá! Aqui está a comanda da *${nomeMesa}*! 😊\n\n📋 *Itens pedidos*:\n`;
    pedidos.forEach((pedido) => {
      if (pedido.itens && Array.isArray(pedido.itens)) {
        pedido.itens.forEach((item) => {
          const itemCardapio = cardapio.find((c) => c.nome === item.nome);
          const precoUnitario = itemCardapio ? itemCardapio.precoUnitario : 0;
          texto += `🥂 ${item.nome} (x${
            item.quantidade
          }) - R$ ${precoUnitario.toFixed(2)} cada = R$ ${(
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

    texto += `\n💰 *Total*: R$ ${total.toFixed(
      2
    )}\n\nObrigado por escolher a gente! 🥂 Qualquer dúvida, é só chamar! 😉`;

    console.log("Texto da comanda gerado com sucesso:", texto);

    const numeroLimpo = telefone.replace(/[^\d+]/g, "");
    const encodedText = encodeURIComponent(texto);
    const whatsappUrl = `whatsapp://send?phone=${numeroLimpo}&text=${encodedText}`;

    console.log("URL do WhatsApp gerada:", whatsappUrl);
    return whatsappUrl;
  } catch (error) {
    console.error("Erro ao gerar texto da comanda para WhatsApp:", error);
    throw error;
  }
};

export const removerMesa = async (mesaId) => {
  const freshDb = await waitForFirebaseInit();
  try {
    console.log("Verificando conexão antes de remover mesa:", mesaId);
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
    console.log("Conexão confirmada, removendo mesa:", mesaId);

    const mesaSnapshot = await freshDb.ref(`mesas/${mesaId}`).once("value");
    const mesa = mesaSnapshot.val();
    if (!mesa) {
      console.log("Mesa não encontrada:", mesaId);
      Alert.alert("Erro", "Mesa não encontrada.");
      return;
    }
    console.log("Dados da mesa:", mesa);

    const mesasJuntadasSnapshot = await freshDb
      .ref("mesasJuntadas")
      .once("value");
    const mesasJuntadas = mesasJuntadasSnapshot.val() || {};
    console.log(
      "Estrutura de mesasJuntadas antes da remoção:",
      JSON.stringify(mesasJuntadas, null, 2)
    );

    const joinedTableIds = new Set();
    const processedTableIds = new Set();

    const collectRelatedJuntaIds = (tableId) => {
      if (processedTableIds.has(tableId)) return;
      processedTableIds.add(tableId);

      if (mesasJuntadas[tableId]) {
        joinedTableIds.add(tableId);
        console.log(
          "Mesa juntada encontrada:",
          tableId,
          "Mesas originais:",
          Object.keys(mesasJuntadas[tableId])
        );
        Object.keys(mesasJuntadas[tableId]).forEach((originalId) => {
          collectRelatedJuntaIds(originalId);
        });
      }

      Object.entries(mesasJuntadas).forEach(([juntaId, juntaData]) => {
        if (Object.keys(juntaData).includes(tableId)) {
          joinedTableIds.add(juntaId);
          console.log(
            "Referência encontrada em mesasJuntadas:",
            juntaId,
            "para mesa:",
            tableId
          );
          collectRelatedJuntaIds(juntaId);
        }
      });
    };

    collectRelatedJuntaIds(mesaId);

    const isMesaJuntada = joinedTableIds.size > 0;
    console.log(
      "É mesa juntada ou referenciada:",
      isMesaJuntada,
      "Joined Table IDs:",
      Array.from(joinedTableIds)
    );

    await removerPedidosDaMesa(mesaId);
    console.log("Pedidos da mesa processados:", mesaId);

    const updates = {};
    updates[`mesas/${mesaId}`] = null;
    console.log("Marcando mesa para remoção:", mesaId);

    if (isMesaJuntada) {
      joinedTableIds.forEach((juntaId) => {
        updates[`mesasJuntadas/${juntaId}`] = null;
        console.log("Marcando mesasJuntadas para remoção:", juntaId);
      });
    }

    await freshDb.ref().update(updates);
    console.log("Atualizações aplicadas para mesa:", mesaId);

    const postDeletionSnapshot = await freshDb
      .ref("mesasJuntadas")
      .once("value");
    const postDeletionMesasJuntadas = postDeletionSnapshot.val() || {};
    const remainingReferences = [];
    Object.entries(postDeletionMesasJuntadas).forEach(
      ([juntaId, juntaData]) => {
        if (
          joinedTableIds.has(juntaId) ||
          Object.keys(juntaData).some((id) => joinedTableIds.has(id))
        ) {
          remainingReferences.push(juntaId);
        }
      }
    );
    if (remainingReferences.length > 0) {
      console.error(
        "Entradas de mesasJuntadas não foram removidas:",
        remainingReferences
      );
      Alert.alert(
        "Erro",
        "Falha ao remover todas as referências de mesas juntadas."
      );
    } else {
      console.log(
        "Todas as referências de mesasJuntadas removidas com sucesso para mesa:",
        mesaId
      );
    }
    console.log(
      "Estrutura de mesasJuntadas após remoção:",
      JSON.stringify(postDeletionMesasJuntadas, null, 2)
    );

    console.log(
      "Mesa e dados associados removidos com sucesso do Firebase:",
      mesaId
    );
  } catch (error) {
    console.error("Erro ao remover mesa do Firebase:", error);
    Alert.alert("Erro", "Não foi possível remover a mesa: " + error.message);
    throw error;
  }
};

export const removerPedidosDaMesa = async (mesaId) => {
  const freshDb = await waitForFirebaseInit();
  try {
    console.log("Removendo pedidos da mesa:", mesaId);
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
      console.log("Pedidos removidos com sucesso da mesa:", mesaId);
    } else {
      console.log("Nenhum pedido encontrado para a mesa:", mesaId);
    }
  } catch (error) {
    console.error("Erro ao remover pedidos da mesa:", error);
    throw error;
  }
};
