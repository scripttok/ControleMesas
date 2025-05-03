import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  FlatList,
  StyleSheet,
  Button,
  Alert,
  TouchableOpacity,
} from "react-native";
import AdicionarItensModal from "./AdicionarItensModal";
import FecharComandaModal from "./FecharComandaModal";
import {
  atualizarStatusPedido,
  getCardapio,
  reverterEstoquePedido,
} from "../services/mesaService";
import { waitForFirebaseInit } from "../services/firebase";

export default function DetalhesMesaModal({
  visible,
  onClose,
  mesa,
  pedidos,
  onAdicionarPedido,
}) {
  const [adicionarItensVisible, setAdicionarItensVisible] = useState(false);
  const [fecharComandaVisible, setFecharComandaVisible] = useState(false);
  const [cardapio, setCardapio] = useState([]);
  const [mesaAtual, setMesaAtual] = useState(mesa || {});
  const [pedidosLocais, setPedidosLocais] = useState(pedidos || []);

  const fetchMesaAtual = async () => {
    if (!mesa?.id) return;
    try {
      const freshDb = await waitForFirebaseInit();
      const ref = freshDb.ref(`mesas/${mesa.id}`);
      const snapshot = await ref.once("value");
      const mesaData = snapshot.val();
      if (mesaData) {
        "(NOBRIDGE) LOG Mesa atualizada do Firebase:", mesaData;
        setMesaAtual({ id: mesa.id, ...mesaData });
      }
    } catch (error) {
      console.error("(NOBRIDGE) ERROR Erro ao buscar mesa do Firebase:", error);
    }
  };

  const atualizarValorRestante = async (totalGeral) => {
    try {
      const freshDb = await waitForFirebaseInit();
      const valorPago = parseFloat(mesaAtual?.valorPago || 0);
      const novoValorRestante = (parseFloat(totalGeral) - valorPago).toFixed(2);
      await freshDb.ref(`mesas/${mesaAtual.id}`).update({
        valorRestante: novoValorRestante,
      });
      setMesaAtual((prev) => ({
        ...prev,
        valorRestante: novoValorRestante,
      }));
      "(NOBRIDGE) LOG Valor restante atualizado:", novoValorRestante;
    } catch (error) {
      console.error(
        "(NOBRIDGE) ERROR Erro ao atualizar valor restante:",
        error
      );
    }
  };

  const handleRemoverItem = async (pedidoId, entregue) => {
    try {
      const freshDb = await waitForFirebaseInit();
      const pedidoRef = freshDb.ref(`pedidos/${pedidoId}`);
      const pedidoSnapshot = await pedidoRef.once("value");
      const pedido = pedidoSnapshot.val();

      if (pedido.entregue) {
        await reverterEstoquePedido(pedidoId);
      } else {
        await pedidoRef.remove();
        "(NOBRIDGE) LOG Pedido removido do Firebase:", pedidoId;
      }

      const novosPedidos = pedidosLocais.filter(
        (pedido) => pedido.id !== pedidoId
      );
      setPedidosLocais(novosPedidos);
      const novoTotalGeral = calcularTotalGeral(novosPedidos);
      await atualizarValorRestante(novoTotalGeral);

      Alert.alert("Sucesso", "Item removido com sucesso!");
    } catch (error) {
      console.error("(NOBRIDGE) ERROR Erro ao remover pedido:", error);
      Alert.alert("Erro", "Não foi possível remover o item: " + error.message);
    }
  };

  useEffect(() => {
    "(NOBRIDGE) LOG Mesa recebida como prop:", mesa;
    setMesaAtual(mesa || {});
    setPedidosLocais(pedidos || []);

    let unsubscribe;
    if (visible) {
      fetchMesaAtual();
      unsubscribe = getCardapio((data) => {
        "(NOBRIDGE) LOG Cardápio recebido no DetalhesMesaModal:", data;
        setCardapio(data);
      });
    }
    return () => {
      if (unsubscribe) {
        ("(NOBRIDGE) LOG Desmontando listener de cardápio no DetalhesMesaModal");
        unsubscribe();
      }
    };
  }, [visible, mesa, pedidos]);

  useEffect(() => {
    if (pedidosLocais.length) {
      const totalGeral = calcularTotalGeral(pedidosLocais);
      atualizarValorRestante(totalGeral);
    }
  }, [pedidosLocais]);

  const handleStatusToggle = async (pedidoId, entregueAtual) => {
    if (entregueAtual) return;

    "(NOBRIDGE) LOG Iniciando atualização de status para pedido:",
      {
        pedidoId,
        novoStatus: !entregueAtual,
      };

    try {
      await atualizarStatusPedido(pedidoId, !entregueAtual);
      "(NOBRIDGE) LOG Status atualizado com sucesso para:",
        {
          pedidoId,
          status: !entregueAtual,
        };

      const novosPedidos = pedidosLocais.map((pedido) =>
        pedido.id === pedidoId
          ? { ...pedido, entregue: !entregueAtual }
          : pedido
      );
      setPedidosLocais(novosPedidos);
    } catch (error) {
      console.error("(NOBRIDGE) ERROR Erro ao atualizar status do pedido:", {
        message: error.message,
        stack: error.stack,
      });
      Alert.alert("Erro", error.message);
    }
  };

  const calcularTotalPedido = (itens) => {
    const itensValidos = Array.isArray(itens) ? itens : [];
    return itensValidos
      .reduce((total, i) => {
        const itemCardapio = cardapio.find((c) => c.nome === i.nome);
        const precoUnitario = itemCardapio ? itemCardapio.precoUnitario : 0;
        return total + (i.quantidade * precoUnitario || 0);
      }, 0)
      .toFixed(2);
  };

  const calcularTotalGeral = (pedidos = pedidosLocais) => {
    const pedidosValidos = Array.isArray(pedidos) ? pedidos : [];
    if (!pedidosValidos.length) return "0.00";
    const total = pedidosValidos.reduce((acc, pedido) => {
      const pedidoTotal = calcularTotalPedido(pedido.itens);
      return acc + parseFloat(pedidoTotal);
    }, 0);
    "(NOBRIDGE) LOG Calculando total geral:",
      { pedidos: pedidosValidos, total };
    return total.toFixed(2);
  };

  const handleAtualizarMesa = (novaMesa) => {
    "(NOBRIDGE) LOG Atualizando mesaAtual com novos dados:", novaMesa;
    setMesaAtual(novaMesa);
    fetchMesaAtual();
  };

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <View style={styles.itemDetails}>
        <Text style={styles.itemText}>
          {(item.itens || [])
            .map(
              (i) =>
                `${i.nome} x${i.quantidade}${
                  i.observacao ? ` (${i.observacao})` : ""
                }`
            )
            .join(", ")}
        </Text>
        <Text style={styles.itemTotal}>
          Total: R$ {calcularTotalPedido(item.itens)}
        </Text>
      </View>
      <View style={styles.itemButtons}>
        <CustomButton
          title={item.entregue ? "Entregue" : "Entregar"}
          onPress={() =>
            !item.entregue && handleStatusToggle(item.id, item.entregue)
          }
          color={item.entregue ? "#ff4444" : "#4CAF50"}
          disabled={item.entregue}
        />
        <CustomButton
          title="X"
          onPress={() => handleRemoverItem(item.id, item.entregue)}
          color="#ff4444"
        />
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.titulo}>
            Mesa de {mesaAtual?.nomeCliente || "Sem cliente"}
          </Text>
          <FlatList
            data={pedidosLocais}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            style={styles.flatList}
            contentContainerStyle={styles.flatListContent}
            ListEmptyComponent={
              <Text style={styles.itemText}>Sem pedidos</Text>
            }
          />
          <Text style={styles.totalGeral}>
            Total Geral: R$ {calcularTotalGeral()}
          </Text>
          <Text style={styles.valorPago}>
            Valor Pago: R$ {(mesaAtual?.valorPago || 0).toFixed(2)}
          </Text>
          {(() => {
            const valorRestante = parseFloat(mesaAtual?.valorRestante || 0);
            return valorRestante > 0 ? (
              <Text style={styles.saldoDevedor}>
                Saldo Devedor: R$ {valorRestante.toFixed(2)}
              </Text>
            ) : null;
          })()}
          <View style={styles.botoes}>
            <CustomButton
              title="Adicionar Itens"
              onPress={() => setAdicionarItensVisible(true)}
              color="#2196F3"
            />
            <CustomButton
              title="Pagar"
              onPress={() => setFecharComandaVisible(true)}
              color="#FFA500"
            />
            <CustomButton title="Voltar" onPress={onClose} color="#666" />
          </View>
        </View>
      </View>
      <AdicionarItensModal
        visible={adicionarItensVisible}
        onClose={() => setAdicionarItensVisible(false)}
        onConfirm={(itens) => {
          onAdicionarPedido(mesaAtual.id, itens);
          setAdicionarItensVisible(false);
        }}
        mesa={mesaAtual}
      />
      <FecharComandaModal
        visible={fecharComandaVisible}
        onClose={() => setFecharComandaVisible(false)}
        mesa={mesaAtual}
        pedidos={pedidosLocais}
        cardapio={cardapio}
        onFecharComanda={() => {
          setFecharComandaVisible(false);
          onClose();
        }}
        onAtualizarMesa={handleAtualizarMesa}
      />
    </Modal>
  );
}

const CustomButton = ({ title, onPress, color, disabled }) => (
  <TouchableOpacity
    style={[
      styles.button,
      { backgroundColor: color || "#2196F3" },
      disabled && { opacity: 0.5 },
    ]}
    onPress={onPress}
    disabled={disabled}
  >
    <Text style={styles.buttonText}>{title}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  modalContent: {
    width: "90%",
    maxWidth: 400,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  titulo: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 15,
  },
  flatList: {
    flexGrow: 0,
    maxHeight: 350,
    marginVertical: 10,
  },
  flatListContent: {
    paddingBottom: 15,
  },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    marginVertical: 5,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemDetails: {
    flex: 1,
    marginRight: 10,
  },
  itemText: {
    fontSize: 16,
    color: "#444",
    fontWeight: "500",
  },
  itemTotal: {
    fontSize: 14,
    color: "#777",
    marginTop: 5,
  },
  itemButtons: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  totalGeral: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    color: "#2196F3",
    marginVertical: 10,
  },
  valorPago: {
    fontSize: 16,
    textAlign: "center",
    color: "#4CAF50",
    marginVertical: 5,
  },
  saldoDevedor: {
    fontSize: 16,
    textAlign: "center",
    color: "#ff4444",
    marginVertical: 5,
  },
  botoes: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 20,
    gap: 15,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#2196F3",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
