import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
} from "react-native";
// import { getCardapio, validarEstoqueParaPedido } from "../services/mesaService";

const formatarNome = (nome) => {
  return nome.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function AdicionarItensModal({
  visible,
  onClose,
  onConfirm,
  mesa,
}) {
  const [itensSelecionados, setItensSelecionados] = useState([]);
  const [itensDisponiveis, setItensDisponiveis] = useState([]);
  const [modalCategoriaVisivel, setModalCategoriaVisivel] = useState(false);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState(null);

  useEffect(() => {
    let unsubscribe;
    if (visible) {
      unsubscribe = getCardapio((data) => {
        console.log(
          "(NOBRIDGE) LOG Itens recebidos em AdicionarItensModal:",
          data
        );
        setItensDisponiveis(data || []);
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [visible]);

  const toggleItem = (item) => {
    console.log(
      "(NOBRIDGE) LOG toggleItem - Tentativa de toggle para item:",
      item
    );
    setItensSelecionados((prev) => {
      const existente = prev.find((i) => i.nome === item.nome);
      console.log("(NOBRIDGE) LOG toggleItem - Itens atuais:", prev);

      if (existente) {
        const novosItens = prev.filter((i) => i.nome !== item.nome);
        console.log(
          "(NOBRIDGE) LOG toggleItem - Removendo item, novos itens:",
          novosItens
        );
        return novosItens;
      }

      if (!item || !item.nome) {
        console.error("(NOBRIDGE) ERROR toggleItem - Item inválido:", item);
        return prev;
      }

      const novoItem = {
        nome: item.nome,
        quantidade: "",
        observacao: "",
      };

      console.log(
        "(NOBRIDGE) LOG toggleItem - Novo item adicionado:",
        novoItem
      );
      const novosItens = [...prev, novoItem];
      return novosItens;
    });
  };

  const atualizarQuantidade = (nome, quantidade) => {
    const parsedQuantidade = quantidade === "" ? "" : parseInt(quantidade) || 0;
    setItensSelecionados((prev) => {
      const updated = prev.map((item) =>
        item.nome === nome ? { ...item, quantidade: parsedQuantidade } : item
      );
      return updated;
    });
  };

  const atualizarObservacao = (nome, observacao) => {
    setItensSelecionados((prev) =>
      prev.map((item) => (item.nome === nome ? { ...item, observacao } : item))
    );
  };

  const handleConfirmar = async () => {
    console.log(
      "(NOBRIDGE) LOG handleConfirmar - Itens selecionados antes de filtrar:",
      itensSelecionados
    );
    const itensValidos = itensSelecionados.filter(
      (item) =>
        item &&
        item.nome &&
        typeof item.nome === "string" &&
        item.quantidade > 0
    );

    console.log(
      "(NOBRIDGE) LOG handleConfirmar - Itens válidos após filtrar:",
      itensValidos
    );

    if (itensValidos.length === 0) {
      console.warn(
        "(NOBRIDGE) WARN handleConfirmar - Nenhum item válido para adicionar"
      );
      Alert.alert(
        "Atenção",
        "Selecione pelo menos um item válido antes de confirmar."
      );
      return;
    }

    try {
      await validarEstoqueParaPedido(itensValidos);
      console.log(
        "(NOBRIDGE) LOG handleConfirmar - Estoque validado, chamando onConfirm com itens:",
        itensValidos
      );
      onConfirm(itensValidos);
      onClose();
      setItensSelecionados([]);
    } catch (error) {
      Alert.alert("Erro", error.message);
    }
  };

  const abrirModalCategoria = (categoria) => {
    setCategoriaSelecionada(categoria);
    setModalCategoriaVisivel(true);
  };

  const fecharModalCategoria = () => {
    setModalCategoriaVisivel(false);
    setCategoriaSelecionada(null);
  };

  const CustomButton = ({ title, onPress, color }) => (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: color }]}
      onPress={onPress}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );

  const renderCategoria = ({ item }) => (
    <TouchableOpacity
      style={styles.categoriaItem}
      onPress={() => abrirModalCategoria(item)}
    >
      <Text style={styles.categoriaTexto}>{item}</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }) => {
    const selecionado = itensSelecionados.find((i) => i.nome === item.nome);
    const nomeFormatado = formatarNome(item.nome);
    return (
      <View style={styles.item}>
        <TouchableOpacity
          style={[styles.itemCheck, selecionado && styles.itemSelecionado]}
          onPress={() => toggleItem(item)}
        >
          <View style={styles.itemContent}>
            {item.imagens && item.imagens.length > 0 && (
              <Image
                source={{ uri: item.imagens[0] }}
                style={styles.itemImagem}
              />
            )}
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTexto}>
                {nomeFormatado} - R$ {(item.precoUnitario || 0).toFixed(2)}
              </Text>
              <Text style={styles.itemDescricao}>
                {item.descrição || "Sem descrição"}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        {selecionado && (
          <View style={styles.inputsContainer}>
            <TextInput
              style={styles.input}
              placeholder="Quantidade"
              keyboardType="numeric"
              value={selecionado.quantidade.toString()}
              onChangeText={(text) => atualizarQuantidade(item.nome, text)}
            />
            <TextInput
              style={styles.inputObservacao}
              placeholder="Observação (opcional)"
              value={selecionado.observacao}
              onChangeText={(text) => atualizarObservacao(item.nome, text)}
            />
          </View>
        )}
      </View>
    );
  };

  const categorias = [
    ...new Set(itensDisponiveis.map((item) => item.categoria)),
  ];

  const itensDaCategoria = categoriaSelecionada
    ? itensDisponiveis.filter((item) => item.categoria === categoriaSelecionada)
    : [];

  if (!itensDisponiveis.length && visible) {
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.titulo}>Carregando cardápio...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <>
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.titulo}>
              Adicionar Itens para {mesa?.nomeCliente || "Cliente"}
            </Text>
            <FlatList
              data={categorias}
              renderItem={renderCategoria}
              keyExtractor={(item) => `cat-${item}`}
              style={styles.flatList}
              contentContainerStyle={styles.flatListContent}
              ListEmptyComponent={
                <Text style={styles.itemTexto}>Sem categorias disponíveis</Text>
              }
            />
            <View style={styles.botoes}>
              <CustomButton
                title="Confirmar"
                onPress={handleConfirmar}
                color="#28A745"
              />
              <CustomButton
                title="Cancelar"
                onPress={() => {
                  setItensSelecionados([]);
                  onClose();
                }}
                color="#D32F2F"
              />
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={modalCategoriaVisivel} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.titulo}>{categoriaSelecionada}</Text>
            <FlatList
              data={itensDaCategoria}
              renderItem={renderItem}
              keyExtractor={(item, index) =>
                `${item.categoria}-${item.nome}-${index}`
              }
              style={styles.flatList}
              contentContainerStyle={styles.flatListContent}
              ListEmptyComponent={
                <Text style={styles.itemTexto}>Sem itens nesta categoria</Text>
              }
            />
            <View style={styles.botoes}>
              <CustomButton
                title="Adicionar"
                onPress={fecharModalCategoria}
                color="#28A745"
              />
              <CustomButton
                title="Fechar"
                onPress={fecharModalCategoria}
                color="#D32F2F"
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  modalContent: {
    width: "90%",
    maxWidth: 350,
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  titulo: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 20,
  },
  flatList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  flatListContent: {
    paddingBottom: 10,
  },
  categoriaItem: {
    padding: 12,
    marginVertical: 4,
    backgroundColor: "#4299e1",
    borderRadius: 8,
    alignItems: "center",
  },
  categoriaTexto: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  item: {
    padding: 12,
    marginVertical: 4,
    backgroundColor: "#F9F9F9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  itemCheck: {
    paddingVertical: 8,
  },
  itemSelecionado: {
    backgroundColor: "#E0F7FA",
    borderColor: "#4CAF50",
  },
  itemContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemImagem: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 10,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemTexto: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  itemDescricao: {
    fontSize: 14,
    color: "#718096",
    marginTop: 2,
  },
  inputsContainer: {
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#4CAF50",
    borderRadius: 8,
    padding: 8,
    width: 70,
    fontSize: 16,
    color: "#000000",
    backgroundColor: "#FFFFFF",
    textAlign: "center",
    marginBottom: 5,
  },
  inputObservacao: {
    borderWidth: 1,
    borderColor: "#4CAF50",
    borderRadius: 8,
    padding: 8,
    fontSize: 16,
    color: "#000000",
    backgroundColor: "#FFFFFF",
    width: "100%",
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
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
