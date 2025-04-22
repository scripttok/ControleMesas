import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import Mesa from "../components/Mesa";
import AdicionarMesaModal from "../components/AdicionarMesaModal";
import DetalhesMesaModal from "../components/DetalhesMesaModal";
import ControleEstoqueModal from "../components/ControleEstoqueModal";
import GerenciarEstoqueCardapioModal from "../components/GerenciarEstoqueCardapioModal";
import GerenciarFichasTecnicasModal from "../components/GerenciarFichasTecnicasModal";

import {
  useNavigation,
  useFocusEffect,
  useRoute,
} from "@react-navigation/native";
import {
  adicionarMesaNoFirebase,
  getMesas,
  getPedidos,
  atualizarMesa,
  juntarMesas,
  adicionarPedido,
  getEstoque,
  removerMesa,
  removerPedidosDaMesa,
} from "../services/mesaService";
import { ensureFirebaseInitialized } from "../services/firebase";

export default function HomeScreen() {
  const [searchText, setSearchText] = useState("");
  const [mesas, setMesas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detalhesVisible, setDetalhesVisible] = useState(false);
  const [estoqueVisible, setEstoqueVisible] = useState(false);
  const [gerenciarVisible, setGerenciarVisible] = useState(false);
  const [fichasTecnicasVisible, setFichasTecnicasVisible] = useState(false);
  const [mesaSelecionada, setMesaSelecionada] = useState([]);
  const [mesaDetalhes, setMesaDetalhes] = useState(null);

  const navigation = useNavigation();
  const route = useRoute();
  const soundRef = useRef(null);
  const unsubscribeRefs = useRef({
    mesas: null,
    pedidos: null,
    estoque: null,
  });

  useEffect(() => {
    if (route.params?.adicionarMesa) {
      setModalVisible(true);
      navigation.setParams({ adicionarMesa: false });
      "route.params:", route.params;
    }
    if (route.params?.controleEstoque) {
      setEstoqueVisible(true);
      navigation.setParams({ controleEstoque: false });
      "route.params:", route.params;
    }
    if (route.params?.gerenciarEstoque) {
      setGerenciarVisible(true);
      navigation.setParams({ gerenciarEstoque: false });
      "route.params:", route.params;
    }
    if (route.params?.gerenciarFichas) {
      setFichasTecnicasVisible(true);
      navigation.setParams({ gerenciarFichas: false });
      "route.params:", route.params;
    }
  }, [route.params, navigation]);

  const setupListeners = useCallback(async () => {
    try {
      await ensureFirebaseInitialized();
      if (unsubscribeRefs.current.mesas) unsubscribeRefs.current.mesas();
      if (unsubscribeRefs.current.pedidos) unsubscribeRefs.current.pedidos();
      if (unsubscribeRefs.current.estoque) unsubscribeRefs.current.estoque();

      unsubscribeRefs.current.mesas = getMesas((data) => setMesas(data));
      unsubscribeRefs.current.pedidos = getPedidos(async (data) => {
        const currentPedidosCount = data.length;
        const previousPedidosCount = pedidos.length;
        setPedidos(data);
      });
      unsubscribeRefs.current.estoque = getEstoque((data) => {
        setEstoque(data);
        const estoqueBaixo = data.filter(
          (item) => item.quantidade <= item.estoqueMinimo
        );
        if (estoqueBaixo.length > 0) {
          Alert.alert(
            "Atenção: Estoque Baixo",
            estoqueBaixo
              .map(
                (item) => `${item.nome} (${item.quantidade} ${item.unidade})`
              )
              .join("\n")
          );
        }
      });
    } catch (error) {
      console.error("Erro ao configurar listeners:", error);
    }
  }, [pedidos.length]);

  const cleanupListeners = useCallback(() => {
    if (unsubscribeRefs.current.mesas) unsubscribeRefs.current.mesas();
    if (unsubscribeRefs.current.pedidos) unsubscribeRefs.current.pedidos();
    if (unsubscribeRefs.current.estoque) unsubscribeRefs.current.estoque();
    if (soundRef.current) {
      soundRef.current
        .unloadAsync()
        .catch((e) => console.error("Erro ao descarregar áudio:", e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setupListeners();
      return cleanupListeners;
    }, [setupListeners, cleanupListeners])
  );

  const adicionarMesa = async ({ nomeCliente }) => {
    const mesaNomeExistente = mesas.find(
      (mesa) => mesa.nomeCliente === nomeCliente
    );
    if (mesaNomeExistente) {
      Alert.alert("Erro", `Já existe uma mesa com o cliente "${nomeCliente}".`);
      return;
    }
    const novaMesa = {
      nomeCliente,
      pedidos: [],
      posX: 0,
      posY: 0,
      status: "aberta",
    };
    "novaMesa:", novaMesa;
    try {
      await adicionarMesaNoFirebase(novaMesa);
      setModalVisible(false);
    } catch (error) {
      Alert.alert(
        "Erro",
        "Não foi possível adicionar a mesa: " + error.message
      );
    }
  };

  const moverMesa = async (mesaId, x, y) => {
    const mesa = mesas.find((m) => m.id === mesaId);
    if (mesa) {
      const novoX = (mesa.posX || 0) + (x || 0);
      const novoY = (mesa.posY || 0) + (y || 0);
      try {
        await atualizarMesa(mesaId, { posX: novoX, posY: novoY });
      } catch (error) {
        console.error("Erro ao mover mesa:", error);
        Alert.alert("Erro", "Não foi possível mover a mesa: " + error.message);
      }
    }
  };

  const soltarMesa = (mesaId) => {
    const mesa = mesas.find((m) => m.id === mesaId);
    if (!mesaSelecionada.length) {
      setMesaSelecionada([mesaId]);
      const isJuntada = mesa && mesa.nomeCliente.includes(" & ");
      Alert.alert(
        "Mesa Selecionada",
        isJuntada
          ? 'Escolha "Separar", "Remover" ou selecione mais mesas para juntar.'
          : "Selecione mais mesas para juntar ou escolha 'Remover'.",
        [
          { text: "Cancelar", onPress: () => setMesaSelecionada([]) },
          ...(isJuntada
            ? [{ text: "Separar", onPress: () => separarMesas(mesaId) }]
            : []),
          {
            text: "Remover",
            onPress: async () => {
              await removerMesaLocal(mesaId);
              setMesaSelecionada([]);
            },
            style: "destructive",
          },
          { text: "Ok" },
        ]
      );
    } else if (!mesaSelecionada.includes(mesaId)) {
      const novasMesasSelecionadas = [...mesaSelecionada, mesaId];
      setMesaSelecionada(novasMesasSelecionadas);
      Alert.alert(
        "Mesa Adicionada",
        `Mesas selecionadas: ${novasMesasSelecionadas.length}. Deseja juntar agora?`,
        [
          { text: "Selecionar Mais", onPress: () => {} },
          {
            text: "Juntar",
            onPress: async () => {
              try {
                await juntarMesas(novasMesasSelecionadas);
                setMesaSelecionada([]);
                Alert.alert("Sucesso", "Mesas juntadas com sucesso!");
              } catch (error) {
                Alert.alert("Erro", error.message);
              }
            },
          },
          { text: "Cancelar", onPress: () => setMesaSelecionada([]) },
        ]
      );
    } else {
      setMesaSelecionada([]);
    }
  };

  const separarMesas = async (mesaId) => {
    "(NOBRIDGE) LOG separarMesas - Iniciando separação para mesaId:", mesaId;
    const mesa = mesas.find((m) => m.id === mesaId);
    "(NOBRIDGE) LOG separarMesas - Mesa encontrada:", mesa;

    if (!mesa || !mesa.nomeCliente || !mesa.nomeCliente.includes(" & ")) {
      ("(NOBRIDGE) LOG separarMesas - Validação falhou: mesa inválida ou não juntada");
      Alert.alert("Erro", "Esta mesa não é uma mesa juntada ou está sem nome.");
      return;
    }

    const hasPagamentoParcial =
      (mesa.valorPago > 0 || mesa.historicoPagamentos?.length > 0) &&
      mesa.valorRestante > 0;
    if (hasPagamentoParcial) {
      ("(NOBRIDGE) LOG separarMesas - Pagamento parcial detectado");
      Alert.alert(
        "Erro",
        "Não é possível separar mesas com pagamentos parciais."
      );
      return;
    }

    const nomesClientes = mesa.nomeCliente.split(" & ").filter((nome) => nome);
    "(NOBRIDGE) LOG separarMesas - Nomes dos clientes:", nomesClientes;
    if (nomesClientes.length === 0) {
      ("(NOBRIDGE) LOG separarMesas - Nenhum nome válido encontrado");
      Alert.alert("Erro", "Nenhum nome de cliente válido encontrado.");
      return;
    }

    try {
      ("(NOBRIDGE) LOG separarMesas - Inicializando Firebase");
      const freshDb = await ensureFirebaseInitialized();
      ("(NOBRIDGE) LOG separarMesas - Buscando pedidos");
      const pedidosSnapshot = await freshDb.ref("pedidos").once("value");
      const todosPedidos = pedidosSnapshot.val() || {};
      "(NOBRIDGE) LOG separarMesas - Todos pedidos:", todosPedidos;

      const pedidosMesaJunta = Object.entries(todosPedidos)
        .filter(([_, pedido]) => pedido.mesa === mesaId)
        .map(([id, pedido]) => ({ id, ...pedido }));
      "(NOBRIDGE) LOG separarMesas - Pedidos da mesa juntada:",
        pedidosMesaJunta;

      // Nova validação: verificar se há pedidos sem mesaOriginal
      const hasNovosPedidos = pedidosMesaJunta.some(
        (pedido) => !pedido.mesaOriginal
      );
      if (hasNovosPedidos) {
        ("(NOBRIDGE) LOG separarMesas - Pedidos novos detectados na mesa juntada");
        Alert.alert(
          "Erro",
          "Não é possível separar mesas com pedidos feitos após a junção."
        );
        return;
      }

      // Agrupar pedidos por mesa original
      const pedidosPorMesaOriginal = {};
      pedidosMesaJunta.forEach((pedido) => {
        const mesaOriginal = pedido.mesaOriginal || mesaId;
        if (!pedidosPorMesaOriginal[mesaOriginal]) {
          pedidosPorMesaOriginal[mesaOriginal] = [];
        }
        pedidosPorMesaOriginal[mesaOriginal].push(pedido);
      });
      "(NOBRIDGE) LOG separarMesas - Pedidos por mesa original:",
        pedidosPorMesaOriginal;

      // Obter IDs das mesas originais a partir dos pedidos
      const mesasOriginaisIds = [
        ...new Set(pedidosMesaJunta.map((p) => p.mesaOriginal).filter(Boolean)),
      ];
      "(NOBRIDGE) LOG separarMesas - IDs das mesas originais:",
        mesasOriginaisIds;

      // Recuperar dados das mesas originais
      const mesasOriginaisSnapshot = await freshDb
        .ref(`mesasJuntadas/${mesaId}`)
        .once("value");
      const mesasOriginais = mesasOriginaisSnapshot.val() || {};
      "(NOBRIDGE) LOG separarMesas - Mesas originais recuperadas:",
        mesasOriginais;

      // Mapear nomes de clientes para IDs das mesas originais
      const nomeParaMesaOriginal = {};
      const usedMesaIds = new Set();
      nomesClientes.forEach((nome, index) => {
        // Tentar encontrar uma mesa original correspondente ao nome
        let mesaOriginalId = Object.keys(mesasOriginais).find(
          (id) =>
            mesasOriginais[id].nomeCliente.includes(nome) &&
            !usedMesaIds.has(id)
        );

        // Se não encontrada, usar um ID de mesaOriginal dos pedidos
        if (!mesaOriginalId) {
          mesaOriginalId = mesasOriginaisIds.find((id) => !usedMesaIds.has(id));
        }

        // Se ainda não encontrada, criar uma nova mesa
        if (!mesaOriginalId) {
          mesaOriginalId = `novaMesa${index}`;
        }

        nomeParaMesaOriginal[nome] = mesaOriginalId;
        usedMesaIds.add(mesaOriginalId);
      });
      "(NOBRIDGE) LOG separarMesas - Mapa nome para mesa original:",
        nomeParaMesaOriginal;

      const mesasComValores = await Promise.all(
        nomesClientes.map(async (nome, index) => {
          "(NOBRIDGE) LOG separarMesas - Processando mesa para nome:", nome;
          const mesaOriginalId = nomeParaMesaOriginal[nome];
          const pedidos = pedidosPorMesaOriginal[mesaOriginalId] || [];
          "(NOBRIDGE) LOG separarMesas - Pedidos para mesa original:", pedidos;

          // Usar dados originais, se disponíveis
          const mesaOriginalData = mesasOriginais[mesaOriginalId] || {};

          const valorTotal = pedidos.reduce((sum, pedido) => {
            const pedidoTotal =
              pedido.itens?.reduce((subSum, item) => {
                "(NOBRIDGE) LOG separarMesas - Calculando item:", item;
                if (!item.nome) {
                  console.warn("(NOBRIDGE) WARN Item sem nome:", item);
                  return subSum;
                }
                return (
                  subSum + (item.quantidade || 0) * (item.precoUnitario || 0)
                );
              }, 0) || 0;
            return sum + pedidoTotal;
          }, 0);
          const valorPago = pedidos.reduce(
            (sum, p) => sum + (p.valorPago || 0),
            0
          );
          const valorRestante = valorTotal - valorPago;
          "(NOBRIDGE) LOG separarMesas - Valores calculados:",
            {
              valorTotal,
              valorPago,
              valorRestante,
            };

          const mesaData = {
            nomeCliente: mesaOriginalData.nomeCliente?.includes(nome)
              ? nome
              : nome,
            posX: mesaOriginalData.posX || mesa.posX || 0,
            posY:
              (mesaOriginalData.posY || mesa.posY || 0) +
              index * 50 -
              (nomesClientes.length - 1) * 25,
            status: mesaOriginalData.status || "aberta",
            createdAt: mesaOriginalData.createdAt || mesa.createdAt,
            valorTotal,
            valorPago,
            valorRestante,
            historicoPagamentos: pedidos.flatMap(
              (p) => p.historicoPagamentos || []
            ),
            pedidos,
            originalId: mesaOriginalId,
          };
          "(NOBRIDGE) LOG separarMesas - Mesa data criada:", mesaData;
          return mesaData;
        })
      );
      "(NOBRIDGE) LOG separarMesas - Mesas com valores:", mesasComValores;

      const updates = {};
      const novasMesas = await Promise.all(
        mesasComValores.map(async (mesaData) => {
          "(NOBRIDGE) LOG separarMesas - Processslimando nova mesa:", mesaData;
          const { pedidos, originalId, ...mesaProps } = mesaData;
          let newId;

          // Verificar se a mesa original existe e deve ser atualizada
          if (
            mesasOriginais[originalId] &&
            !originalId.startsWith("novaMesa")
          ) {
            newId = originalId;
            updates[`mesas/${newId}`] = {
              ...mesaProps,
              id: newId,
            };
            "(NOBRIDGE) LOG separarMesas - Atualizando mesa existente:", newId;
          } else {
            ("(NOBRIDGE) LOG separarMesas - Adicionando nova mesa ao Firebase");
            newId = await adicionarMesaNoFirebase(mesaProps);
          }

          pedidos.forEach((p) => {
            "(NOBRIDGE) LOG separarMesas - Atualizando pedido:", p.id;
            updates[`pedidos/${p.id}/mesa`] = newId;
            updates[`pedidos/${p.id}/mesaOriginal`] = null;
          });

          return { id: newId, pedidos };
        })
      );
      "(NOBRIDGE) LOG separarMesas - Novas mesas criadas:", novasMesas;

      // Delete only the mesasJuntadas entry, not the reused table
      updates[`mesasJuntadas/${mesaId}`] = null;
      "(NOBRIDGE) LOG separarMesas - Atualizações preparadas:", updates;
      await freshDb.ref().update(updates);
      ("(NOBRIDGE) LOG separarMesas - Atualizações aplicadas com sucesso");

      setMesaSelecionada([]);
      Alert.alert("Sucesso", "Mesas separadas com sucesso!");
    } catch (error) {
      console.error("(NOBRIDGE) ERROR separarMesas - Erro:", error);
      Alert.alert(
        "Erro",
        "Não foi possível separar as mesas: " + error.message
      );
    }
  };
  const verPedidos = useCallback((mesa) => {
    setMesaDetalhes(mesa);
    setDetalhesVisible(true);
  }, []);

  const handleAdicionarPedido = useCallback(async (mesaId, itens) => {
    try {
      await adicionarPedido(mesaId, itens);
    } catch (error) {
      Alert.alert(
        "Erro",
        "Não foi possível adicionar o pedido: " + error.message
      );
    }
  }, []);

  const handleAtualizarMesa = useCallback((novaMesa) => {
    setMesas((prevMesas) =>
      prevMesas.map((m) => (m.id === novaMesa.id ? novaMesa : m))
    );
    setMesaDetalhes(novaMesa);
  }, []);

  const removerMesaLocal = async (mesaId) => {
    const mesa = mesas.find((m) => m.id === mesaId);
    if (!mesa) {
      Alert.alert("Erro", "Mesa não encontrada.");
      return;
    }
    const mesaPedidos = pedidos.filter((p) => p.mesa === mesa.id);
    const temPedidosAbertos = mesaPedidos.some((p) => !p.entregue);
    if (mesa.status === "aberta" && mesaPedidos.length > 0) {
      Alert.alert(
        "Erro",
        "Não é possível remover uma mesa aberta com pedidos."
      );
      return;
    }
    if (mesa.status === "fechada" && temPedidosAbertos) {
      Alert.alert(
        "Erro",
        "Não é possível remover uma mesa com pedidos abertos."
      );
      return;
    }
    try {
      await removerPedidosDaMesa(mesa.id);
      await removerMesa(mesaId);
      setMesas((prevMesas) => prevMesas.filter((m) => m.id !== mesaId));
      if (mesaDetalhes && mesaDetalhes.id === mesaId) {
        setMesaDetalhes(null);
        setDetalhesVisible(false);
      }
      setMesaSelecionada(null);
      Alert.alert("Sucesso", "Mesa removida com sucesso!");
    } catch (error) {
      Alert.alert("Erro", "Não foi possível remover a mesa: " + error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.openDrawer()}>
          <Icon name="menu" size={30} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <MaterialCommunityIcons
            name="chef-hat"
            size={30}
            color="#FFF"
            style={styles.chefHatIcon}
          />
          <Text style={styles.titulo}>Mesas do Restaurante</Text>
        </View>
      </View>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar por nome do cliente"
        placeholderTextColor="#aaa"
        value={searchText}
        onChangeText={setSearchText}
      />
      <ScrollView contentContainerStyle={styles.grade}>
        {mesas
          .filter((mesa) =>
            mesa.nomeCliente.toLowerCase().includes(searchText.toLowerCase())
          )
          .sort((a, b) => a.nomeCliente.localeCompare(b.nomeCliente))
          .map((mesa) => {
            const mesaPedidos = pedidos.filter((p) => p.mesa === mesa.id);
            return (
              <Mesa
                key={mesa.id}
                mesa={mesa}
                pedidos={mesaPedidos}
                onMove={moverMesa}
                onDrop={soltarMesa}
                onVerPedidos={verPedidos}
              />
            );
          })}
      </ScrollView>

      <AdicionarMesaModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAdicionar={adicionarMesa}
      />
      {mesaDetalhes && (
        <DetalhesMesaModal
          visible={detalhesVisible}
          onClose={() => setDetalhesVisible(false)}
          mesa={mesaDetalhes}
          pedidos={pedidos.filter((p) => p.mesa === mesaDetalhes.id)}
          onAdicionarPedido={handleAdicionarPedido}
          onAtualizarMesa={handleAtualizarMesa}
        />
      )}
      <ControleEstoqueModal
        visible={estoqueVisible}
        onClose={() => setEstoqueVisible(false)}
      />
      <GerenciarEstoqueCardapioModal
        visible={gerenciarVisible}
        onClose={() => setGerenciarVisible(false)}
      />
      <GerenciarFichasTecnicasModal
        visible={fichasTecnicasVisible}
        onClose={() => setFichasTecnicasVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: "#5C4329",
  },
  header: {
    marginTop: 30,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  titleContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  chefHatIcon: {
    position: "absolute",
    top: -10,
    left: 20,
    transform: [{ rotate: "-20deg" }],
  },
  titulo: {
    fontSize: 24,
    textAlign: "center",
    color: "#fff",
  },
  grade: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  searchInput: {
    height: 40,
    borderColor: "#fff",
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
    color: "#fff",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
});
