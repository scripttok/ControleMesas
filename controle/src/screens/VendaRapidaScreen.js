import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import {
  getCardapio,
  validarEstoqueParaPedido,
  adicionarPedido,
  removerPedidosDaMesa,
  atualizarStatusPedido,
} from "../services/mesaService";

const VendaRapidaScreen = () => {
  const [termoBusca, setTermoBusca] = useState("");
  const [itensDisponiveis, setItensDisponiveis] = useState([]);
  const [itensSelecionados, setItensSelecionados] = useState([]);
  const [valorTotal, setValorTotal] = useState(0);

  // Carrega itens do cardápio
  useEffect(() => {
    const unsubscribe = getCardapio((data) => {
      console.log("(NOBRIDGE) LOG VendaRapidaScreen - Itens recebidos:", data);
      setItensDisponiveis(data || []);
    });
    return () => unsubscribe && unsubscribe();
  }, []);

  // Calcula o valor total sempre que itensSelecionados mudar
  useEffect(() => {
    const total = itensSelecionados.reduce((sum, item) => {
      return sum + (item.quantidade * item.precoUnitario || 0);
    }, 0);
    setValorTotal(total);
  }, [itensSelecionados]);

  // Filtra itens com base no termo de busca
  const itensFiltrados = itensDisponiveis
    .filter((item) =>
      item?.nome && termoBusca
        ? item.nome.toLowerCase().startsWith(termoBusca.toLowerCase())
        : true
    )
    .sort((a, b) => a.nome.localeCompare(b.nome));

  // Adiciona ou incrementa item
  const adicionarItem = (item) => {
    setItensSelecionados((prev) => {
      const existente = prev.find((i) => i.nome === item.nome);
      if (existente) {
        return prev.map((i) =>
          i.nome === item.nome ? { ...i, quantidade: i.quantidade + 1 } : i
        );
      }
      return [
        ...prev,
        {
          nome: item.nome,
          quantidade: 1,
          precoUnitario: item.precoUnitario || 0,
          observacao: "",
        },
      ];
    });
  };

  // Incrementa quantidade de um item
  const incrementarQuantidade = (nome) => {
    setItensSelecionados((prev) =>
      prev.map((item) =>
        item.nome === nome ? { ...item, quantidade: item.quantidade + 1 } : item
      )
    );
  };

  // Decrementa quantidade de um item
  const decrementarQuantidade = (nome) => {
    setItensSelecionados((prev) =>
      prev.map((item) =>
        item.nome === nome && item.quantidade > 1
          ? { ...item, quantidade: item.quantidade - 1 }
          : item
      )
    );
  };

  // Remove item da lista
  const removerItem = (nome) => {
    setItensSelecionados((prev) => prev.filter((item) => item.nome !== nome));
  };

  // Finaliza a compra e atualiza o estoque
  const handleFinalizarCompra = async () => {
    if (itensSelecionados.length === 0) {
      Alert.alert(
        "Atenção",
        "Selecione pelo menos um item para finalizar a compra."
      );
      return;
    }

    const itensValidos = itensSelecionados.filter(
      (item) =>
        item.quantidade > 0 && item.nome && typeof item.nome === "string"
    );

    if (itensValidos.length === 0) {
      Alert.alert("Atenção", "Nenhum item válido selecionado.");
      return;
    }

    try {
      console.log(
        "(NOBRIDGE) LOG VendaRapidaScreen - Iniciando finalização. Itens:",
        itensValidos
      );
      await validarEstoqueParaPedido(itensValidos);

      // Cria um pedido temporário para registrar a venda
      const pedidoId = await adicionarPedido("venda-rapida", itensValidos);
      console.log(
        "(NOBRIDGE) LOG VendaRapidaScreen - Pedido temporário criado:",
        pedidoId
      );

      // Marca o pedido como entregue para dar baixa no estoque
      await atualizarStatusPedido(pedidoId, true);
      console.log(
        "(NOBRIDGE) LOG VendaRapidaScreen - Estoque atualizado para pedido:",
        pedidoId
      );

      // Remove o pedido temporário
      await removerPedidosDaMesa("venda-rapida");
      console.log(
        "(NOBRIDGE) LOG VendaRapidaScreen - Pedido temporário removido"
      );

      Alert.alert("Sucesso", "Compra finalizada com sucesso!");
      setItensSelecionados([]);
      setTermoBusca("");
    } catch (error) {
      console.error(
        "(NOBRIDGE) ERROR VendaRapidaScreen - Erro ao finalizar:",
        error
      );
      Alert.alert(
        "Erro",
        `Não foi possível finalizar a compra: ${error.message}`
      );
    }
  };

  // Componente para botão personalizado
  const CustomButton = ({ title, onPress, color }) => (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: color }]}
      onPress={onPress}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );

  // Renderiza cada item na lista de busca
  const renderItem = ({ item }) => {
    const selecionado = itensSelecionados.find((i) => i.nome === item.nome);
    return (
      <TouchableOpacity
        style={[styles.item, selecionado && styles.itemSelecionado]}
        onPress={() => adicionarItem(item)}
      >
        <View style={styles.itemContent}>
          <Text style={styles.itemTexto}>
            {item.nome} - R$ {(item.precoUnitario || 0).toFixed(2)}
          </Text>
          {selecionado && (
            <Text style={styles.itemQuantidade}>
              Quantidade: {selecionado.quantidade}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Renderiza cada item selecionado na lista final
  const renderItemSelecionado = ({ item }) => (
    <View style={styles.itemContainer}>
      <View style={styles.textContainer}>
        <Text style={styles.itemText}>
          {item.nome} (x{item.quantidade}) - R${" "}
          {(item.precoUnitario * item.quantidade).toFixed(2)}
        </Text>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.quantButton}
          onPress={() => decrementarQuantidade(item.nome)}
        >
          <Icon name="remove" size={20} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quantButton}
          onPress={() => incrementarQuantidade(item.nome)}
        >
          <Icon name="add" size={20} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => removerItem(item.nome)}
        >
          <Icon name="delete" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Venda Rápida</Text>
      <View style={styles.buscaContainer}>
        <TextInput
          style={styles.inputBusca}
          placeholder="Buscar item..."
          placeholderTextColor="#000"
          value={termoBusca}
          onChangeText={setTermoBusca}
        />
        {termoBusca ? (
          <TouchableOpacity
            style={styles.limparBusca}
            onPress={() => setTermoBusca("")}
          >
            <Text style={styles.limparBuscaTexto}>X</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <FlatList
        data={itensFiltrados}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.nome}-${index}`}
        style={styles.flatList}
        contentContainerStyle={styles.contentContainer}
        ListEmptyComponent={() => (
          <Text style={styles.itemTexto}>
            {termoBusca
              ? `Nenhum item encontrado para "${termoBusca}"`
              : "Nenhum item disponível"}
          </Text>
        )}
      />
      <View style={styles.selecionadosContainer}>
        <Text style={styles.subTitulo}>Itens Selecionados</Text>
        <FlatList
          data={itensSelecionados}
          renderItem={renderItemSelecionado}
          keyExtractor={(item, index) => `${item.nome}-${index}`}
          style={styles.flatList}
          contentContainerStyle={styles.contentContainer}
          ListEmptyComponent={() => (
            <Text style={styles.itemTexto}>Nenhum item selecionado</Text>
          )}
        />
        <Text style={styles.totalText}>Total: R$ {valorTotal.toFixed(2)}</Text>
      </View>
      <View style={styles.botoes}>
        <CustomButton
          title="Finalizar Compra"
          onPress={handleFinalizarCompra}
          color="#28A745"
        />
        <CustomButton
          title="Cancelar"
          onPress={() => {
            setItensSelecionados([]);
            setTermoBusca("");
          }}
          color="#D32F2F"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    backgroundColor: "#5C4329",
  },
  titulo: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 10,
  },
  buscaContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  inputBusca: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#fff",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: "#fff",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  limparBusca: {
    marginLeft: 10,
    padding: 5,
  },
  limparBuscaTexto: {
    fontSize: 16,
    color: "#D32F2F",
    fontWeight: "bold",
  },
  flatList: {
    maxHeight: 250,
    marginBottom: 20,
  },
  contentContainer: {
    paddingBottom: 10,
  },
  item: {
    padding: 12,
    marginVertical: 4,
    backgroundColor: "#F9F9F9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  itemSelecionado: {
    backgroundColor: "#E0F7FA",
    borderColor: "#4CAF50",
  },
  itemContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemTexto: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  itemQuantidade: {
    fontSize: 14,
    color: "#28A745",
  },
  selecionadosContainer: {
    flex: 1,
    marginTop: 10,
  },
  subTitulo: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
  },
  totalText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "right",
    marginTop: 10,
  },
  botoes: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 15,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
    marginBottom: 38,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  itemContainer: {
    padding: 12,
    marginVertical: 4,
    backgroundColor: "#F9F9F9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  textContainer: {
    marginBottom: 8,
  },
  itemText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
    flexWrap: "wrap",
    maxWidth: "100%",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  quantButton: {
    backgroundColor: "#28A745",
    padding: 8,
    borderRadius: 5,
  },
  deleteButton: {
    backgroundColor: "#D32F2F",
    padding: 8,
    borderRadius: 5,
  },
});

export default VendaRapidaScreen;
