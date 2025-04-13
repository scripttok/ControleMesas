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
// import {
//   adicionarMesaNoFirebase,
//   getMesas,
//   getPedidos,
//   atualizarMesa,
//   juntarMesas,
//   adicionarPedido,
//   getEstoque,
//   removerMesa,
//   removerPedidosDaMesa,
// } from "../services/mesaService";
// import { ensureFirebaseInitialized } from "../services/firebase";

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
  const [mesaSelecionada, setMesaSelecionada] = useState(null);
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
      console.log("route.params:", route.params);
    }
    if (route.params?.controleEstoque) {
      setEstoqueVisible(true);
      navigation.setParams({ controleEstoque: false });
      console.log("route.params:", route.params);
    }
    if (route.params?.gerenciarEstoque) {
      setGerenciarVisible(true);
      navigation.setParams({ gerenciarEstoque: false });
      console.log("route.params:", route.params);
    }
    if (route.params?.gerenciarFichas) {
      setFichasTecnicasVisible(true);
      navigation.setParams({ gerenciarFichas: false });
      console.log("route.params:", route.params);
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
        // if (
        //   currentPedidosCount > previousPedidosCount &&
        //   previousPedidosCount !== 0
        // ) {
        //   const { sound } = await Audio.Sound.createAsync(
        //     require("../../assets/notification.mp3")
        //   );
        //   soundRef.current = sound;
        //   await sound.playAsync();
        // }
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
    // Removido numeroMesa
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
    console.log("novaMesa:", novaMesa);
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
    if (!mesaSelecionada) {
      setMesaSelecionada(mesaId);
      const isJuntada = mesa && mesa.nomeCliente.includes(" & "); // Ajustado para verificar nomeCliente
      Alert.alert(
        "Mesa Selecionada",
        isJuntada
          ? 'Escolha "Separar", "Remover" ou junte com outra mesa.'
          : "Solte outra mesa para juntar ou escolha 'Remover'.",
        [
          { text: "Cancelar", onPress: () => setMesaSelecionada(null) },
          ...(isJuntada
            ? [{ text: "Separar", onPress: () => separarMesas(mesaId) }]
            : []),
          {
            text: "Remover",
            onPress: async () => {
              await removerMesaLocal(mesaId);
              setMesaSelecionada(null);
            },
            style: "destructive",
          },
          { text: "Ok" },
        ]
      );
    } else if (mesaSelecionada !== mesaId) {
      Alert.alert("Juntar Mesas", "Deseja juntar essas mesas?", [
        { text: "Cancelar", onPress: () => setMesaSelecionada(null) },
        {
          text: "Juntar",
          onPress: async () => {
            try {
              await juntarMesas(mesaSelecionada, mesaId);
              setMesaSelecionada(null);
            } catch (error) {
              Alert.alert("Erro", "Não foi possível juntar as mesas.");
            }
          },
        },
      ]);
    } else {
      setMesaSelecionada(null);
    }
  };

  const separarMesas = async (mesaId) => {
    const mesa = mesas.find((m) => m.id === mesaId);
    if (!mesa || !mesa.nomeCliente.includes(" & ")) return; // Ajustado para verificar nomeCliente
    const [nome1, nome2] = mesa.nomeCliente.split(" & ");
    try {
      const freshDb = await ensureFirebaseInitialized();
      const pedidosSnapshot = await freshDb.ref("pedidos").once("value");
      const todosPedidos = pedidosSnapshot.val() || {};
      const pedidosMesaJunta = Object.entries(todosPedidos)
        .filter(([_, pedido]) => pedido.mesa === mesa.id) // Usar mesa.id
        .map(([id, pedido]) => ({ id, ...pedido }));
      const pedidosMesa1 = pedidosMesaJunta.filter(
        (p) => p.mesaOriginal === mesa.id || !p.mesaOriginal // Ajustar lógica se necessário
      );
      const pedidosMesa2 = pedidosMesaJunta.filter(
        (p) => p.mesaOriginal && p.mesaOriginal !== mesa.id
      );
      if (pedidosMesa2.length === 0 && pedidosMesa1.length > 0) {
        const metade = Math.ceil(pedidosMesa1.length / 2);
        pedidosMesa2.push(...pedidosMesa1.splice(metade));
      }
      const novaMesa1 = {
        nomeCliente: nome1,
        posX: mesa.posX || 0,
        posY: (mesa.posY || 0) - 50,
        status: "aberta",
        createdAt: mesa.createdAt,
      };
      const novaMesa2 = {
        nomeCliente: nome2,
        posX: mesa.posX || 0,
        posY: (mesa.posY || 0) + 50,
        status: "aberta",
        createdAt: mesa.createdAt,
      };
      const updates = {};
      let mesa1Id, mesa2Id;
      await Promise.all([
        adicionarMesaNoFirebase(novaMesa1).then((id) => (mesa1Id = id)),
        adicionarMesaNoFirebase(novaMesa2).then((id) => (mesa2Id = id)),
      ]);
      pedidosMesa1.forEach((p) => {
        updates[`pedidos/${p.id}/mesa`] = mesa1Id;
        if (p.mesaOriginal) updates[`pedidos/${p.id}/mesaOriginal`] = null;
      });
      pedidosMesa2.forEach((p) => {
        updates[`pedidos/${p.id}/mesa`] = mesa2Id;
        if (p.mesaOriginal) updates[`pedidos/${p.id}/mesaOriginal`] = null;
      });
      await Promise.all([
        freshDb.ref(`mesas/${mesaId}`).remove(),
        freshDb.ref().update(updates),
      ]);
      setMesaSelecionada(null);
    } catch (error) {
      console.error("Erro ao separar mesas:", error);
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
    // Usar mesaId
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
    const mesaPedidos = pedidos.filter((p) => p.mesa === mesa.id); // Usar mesa.id
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
      await removerPedidosDaMesa(mesa.id); // Usar mesa.id
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
          .sort((a, b) => a.nomeCliente.localeCompare(b.nomeCliente)) // Ordenar por nomeCliente
          .map((mesa) => {
            const mesaPedidos = pedidos.filter((p) => p.mesa === mesa.id); // Usar mesa.id
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
          pedidos={pedidos.filter((p) => p.mesa === mesaDetalhes.id)} // Usar mesa.id
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
