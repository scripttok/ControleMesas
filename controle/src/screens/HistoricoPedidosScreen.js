import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import {
  getHistoricoPedidos,
  removerPedidoDoHistorico,
} from "../services/mesaService";

export default function HistoricoPedidosScreen() {
  const navigation = useNavigation();
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState("cliente");

  const carregarHistorico = useCallback(() => {
    setRefreshing(true);
    const unsubscribe = getHistoricoPedidos((data) => {
      setHistorico(data);
      setLoading(false);
      setRefreshing(false);
    });
    return unsubscribe;
  }, []);

  useFocusEffect(
    useCallback(() => {
      setRefreshing(true);
      const unsubscribe = getHistoricoPedidos((data) => {
        setHistorico(data);
        setLoading(false);
        setRefreshing(false);
      });

      return () => {
        if (unsubscribe) {
          console.log("Desmontando listener de histórico");
          unsubscribe();
        }
      };
    }, [])
  );

  useEffect(() => {
    let isMounted = true;
    let unsubscribe = null;

    const loadData = async () => {
      unsubscribe = carregarHistorico();
    };

    loadData();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [carregarHistorico]);

  const removerPedido = async (pedidoId) => {
    Alert.alert(
      "Confirmar Remoção",
      "Tem certeza que deseja remover este pedido do histórico?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              setHistorico((prev) => prev.filter((p) => p.id !== pedidoId));
              await removerPedidoDoHistorico(pedidoId);
              Alert.alert("Sucesso", "Pedido removido do histórico!");
            } catch (error) {
              setHistorico((prev) => [...prev]);
              Alert.alert("Erro", "Não foi possível remover o pedido.");
            }
          },
        },
      ]
    );
  };

  const calcularValorDevendo = (pedido) => {
    const totalPagoParcias =
      pedido.historicoPagamentos?.reduce(
        (sum, pagamento) => sum + (parseFloat(pagamento.valor) || 0),
        0
      ) || 0;

    const totalPagoFinal = parseFloat(pedido.recebido) || 0;
    const totalPagoTotal = totalPagoParcias + totalPagoFinal;

    const diferenca = pedido.total - totalPagoTotal;
    return Math.abs(diferenca) < 0.01 ? 0 : Math.max(0, diferenca);
  };

  const filtrarHistorico = () => {
    if (!searchTerm.trim()) return historico;

    return historico.filter((pedido) => {
      if (searchType === "cliente") {
        return pedido.nomeCliente
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
      } else {
        const dataPedido = new Date(pedido.dataFechamento);
        const dia = dataPedido.getDate().toString().padStart(2, "0");
        const mes = (dataPedido.getMonth() + 1).toString().padStart(2, "0");
        const ano = dataPedido.getFullYear();
        const dataFormatada = `${dia}/${mes}/${ano}`;
        return dataFormatada.includes(searchTerm);
      }
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Histórico de Pedidos</Text>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={`Buscar por ${
            searchType === "cliente" ? "nome do cliente" : "data (dd/mm/aaaa)"
          }`}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor="#999"
        />

        <View style={styles.searchTypeContainer}>
          <TouchableOpacity
            style={[
              styles.searchTypeButton,
              searchType === "cliente" && styles.searchTypeButtonActive,
            ]}
            onPress={() => setSearchType("cliente")}
          >
            <Text style={styles.searchTypeButtonText}>Cliente</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.searchTypeButton,
              searchType === "data" && styles.searchTypeButtonActive,
            ]}
            onPress={() => setSearchType("data")}
          >
            <Text style={styles.searchTypeButtonText}>Data</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFA500" />
          <Text style={styles.loadingText}>Carregando histórico...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={carregarHistorico}
              colors={["#FFA500"]}
              tintColor="#FFA500"
            />
          }
        >
          {filtrarHistorico().length === 0 ? (
            <Text style={styles.semPedidos}>
              {searchTerm
                ? "Nenhum resultado encontrado"
                : "Nenhum pedido no histórico"}
            </Text>
          ) : (
            filtrarHistorico().map((pedido) => {
              const valorDevendo = calcularValorDevendo(pedido);
              const comandaQuitada = valorDevendo <= 0;

              return (
                <View key={pedido.id} style={styles.pedidoCard}>
                  <View style={styles.headerCard}>
                    <Text style={styles.pedidoTitle}>{pedido.nomeCliente}</Text>
                  </View>

                  <View style={styles.detalhesContainer}>
                    <View style={styles.detalheRow}>
                      <Text style={styles.detalheLabel}>Data:</Text>
                      <Text style={styles.detalheValue}>
                        {new Date(pedido.dataFechamento).toLocaleString(
                          "pt-BR"
                        )}
                      </Text>
                    </View>

                    <View style={styles.detalheRow}>
                      <Text style={styles.detalheLabel}>Total da comanda:</Text>
                      <Text style={styles.detalheValue}>
                        R${" "}
                        {pedido.totalSemDesconto?.toFixed(2) ||
                          pedido.total.toFixed(2)}
                      </Text>
                    </View>

                    {pedido.desconto > 0 && (
                      <View style={styles.detalheRow}>
                        <Text style={styles.detalheLabel}>Desconto:</Text>
                        <Text
                          style={[styles.detalheValue, styles.descontoText]}
                        >
                          -R$ {pedido.desconto.toFixed(2)}
                        </Text>
                      </View>
                    )}

                    <View style={styles.detalheRow}>
                      <Text
                        style={[styles.detalheLabel, styles.totalPagoLabel]}
                      >
                        Pago:
                      </Text>
                      <Text
                        style={[styles.detalheValue, styles.totalPagoValue]}
                      >
                        R$ {(pedido.recebido || 0).toFixed(2)}
                      </Text>
                    </View>

                    {pedido.historicoPagamentos?.length > 0 && (
                      <View style={styles.pagamentosContainer}>
                        <Text style={styles.detalheLabel}>
                          Pagamentos parciais:
                        </Text>
                        {pedido.historicoPagamentos.map((pagamento, index) => (
                          <View key={index} style={styles.pagamentoRow}>
                            <Text style={styles.pagamentoData}></Text>
                            <Text style={styles.pagamentoValor}>
                              R$ {pagamento.valor.toFixed(2)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {!comandaQuitada ? (
                      <View style={styles.detalheRow}>
                        <Text style={styles.detalheLabel}>Devendo:</Text>
                        <Text style={[styles.detalheValue, styles.devencoText]}>
                          R$ {valorDevendo.toFixed(2)}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.detalheRow}>
                        <Text style={styles.detalheLabel}>Status:</Text>
                        <Text style={[styles.detalheValue, styles.quitadoText]}>
                          PAGO
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.footerCard}>
                    <TouchableOpacity
                      style={styles.removerButton}
                      onPress={() => removerPedido(pedido.id)}
                    >
                      <Text style={styles.removerButtonText}>Remover</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <TouchableOpacity
        style={styles.voltarButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.voltarButtonText}>Voltar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#5C4329",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#FFF",
    marginTop: 10,
  },
  titulo: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFA500",
    textAlign: "center",
    marginVertical: 16,
  },
  searchContainer: {
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  searchInput: {
    backgroundColor: "#FFF",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#333",
    marginBottom: 8,
  },
  searchTypeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  searchTypeButton: {
    flex: 1,
    padding: 10,
    backgroundColor: "#444",
    alignItems: "center",
    borderRadius: 6,
    marginHorizontal: 4,
  },
  searchTypeButtonActive: {
    backgroundColor: "#FFA500",
  },
  searchTypeButtonText: {
    color: "#FFF",
    fontWeight: "bold",
  },
  scrollContent: {
    paddingBottom: 20,
  },
  pedidoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    marginBottom: 16,
    overflow: "hidden",
    elevation: 3,
  },
  headerCard: {
    backgroundColor: "#FFA500",
    padding: 12,
  },
  pedidoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#5C4329",
  },
  pedidoCliente: {
    fontSize: 14,
    color: "#5C4329",
    marginTop: 4,
  },
  detalhesContainer: {
    padding: 12,
  },
  detalheRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  detalheLabel: {
    fontSize: 15,
    color: "#333",
    fontWeight: "600",
  },
  detalheValue: {
    fontSize: 15,
    color: "#333",
    fontWeight: "bold",
  },
  descontoText: {
    color: "#E74C3C",
  },
  devencoText: {
    color: "#C0392B",
    fontStyle: "italic",
  },
  pagamentosContainer: {
    marginBottom: 8,
  },
  pagamentoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  pagamentoData: {
    fontSize: 13,
    color: "#555",
  },
  pagamentoValor: {
    fontSize: 13,
    color: "#555",
    fontWeight: "bold",
  },
  semPedidos: {
    fontSize: 16,
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 20,
  },
  voltarButton: {
    backgroundColor: "#FF4444",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  voltarButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  removerButton: {
    backgroundColor: "#E74C3C",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  removerButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  pagamentoMetodo: {
    fontSize: 13,
    color: "#555",
    marginLeft: 8,
    fontStyle: "italic",
  },
  secaoTotais: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  secaoTitulo: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#5C4329",
    marginBottom: 8,
    textAlign: "center",
  },
  totalLabel: {
    fontWeight: "600",
    color: "#333",
  },
  totalValue: {
    fontWeight: "bold",
    color: "#5C4329",
    fontSize: 16,
  },
  totalPagoLabel: {
    fontWeight: "600",
    color: "#27AE60",
  },
  totalPagoValue: {
    fontWeight: "bold",
    color: "#27AE60",
    fontSize: 16,
  },
});
