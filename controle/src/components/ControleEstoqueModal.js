import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  FlatList,
  StyleSheet,
  Button,
  TextInput,
  Alert,
  Animated,
  TouchableOpacity,
} from "react-native";
import {
  getEstoque,
  removerItemEstoqueECardapio,
} from "../services/mesaService";
import { waitForFirebaseInit } from "../services/firebase";

async function atualizarItemEstoque(nomeItem, novosDados, categoria) {
  const db = await waitForFirebaseInit();
  await db.ref(`estoque/${nomeItem}`).update(novosDados);
  if (categoria) {
    await db.ref(`cardapio/${categoria}/${nomeItem}`).update({
      nome: novosDados.nome,
      precoUnitario: novosDados.precoUnitario,
      categoria: novosDados.categoria,
    });
  }
}

export default function ControleEstoqueModal({ visible, onClose }) {
  const [estoque, setEstoque] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);
  const slideAnim = useRef(new Animated.Value(-300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (confirmModalVisible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
              toValue: 0.3,
              duration: 500,
              useNativeDriver: true,
            }),
          ])
        ),
      ]).start();
    } else {
      slideAnim.setValue(-300);
      fadeAnim.setValue(0);
    }
  }, [confirmModalVisible]);

  useEffect(() => {
    let unsubscribe;
    if (visible) {
      unsubscribe = getEstoque((data) => {
        const estoqueAjustado = Object.entries(data || {}).map(
          ([nome, info]) => ({
            id: nome,
            nome,
            ...info,
          })
        );
        setEstoque(estoqueAjustado);
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [visible]);

  const handleEditarItem = (item) => {
    // Garantir que todos os campos, incluindo precoUnitario, sejam copiados corretamente
    setItemEditando({
      id: item.id,
      nome: item.nome,
      quantidade: String(item.quantidade || ""),
      unidade: item.unidade || "",
      precoUnitario: String(item.precoUnitario || ""), // Converte para string explicitamente
      categoria: item.categoria || "",
    });
    setEditModalVisible(true);
  };

  const handleSalvarEdicao = async () => {
    if (
      !itemEditando.nome ||
      !itemEditando.quantidade ||
      !itemEditando.precoUnitario
    ) {
      Alert.alert("Erro", "Nome, quantidade e preço são obrigatórios.");
      return;
    }

    const quantidade = parseFloat(itemEditando.quantidade);
    const precoUnitario = parseFloat(itemEditando.precoUnitario);
    if (isNaN(quantidade) || quantidade < 0) {
      Alert.alert("Erro", "Quantidade deve ser um número válido.");
      return;
    }
    if (isNaN(precoUnitario) || precoUnitario < 0) {
      Alert.alert("Erro", "Preço deve ser um número válido.");
      return;
    }

    try {
      await atualizarItemEstoque(
        itemEditando.id,
        {
          nome: itemEditando.nome,
          quantidade: quantidade,
          unidade: itemEditando.unidade || "unidades",
          precoUnitario: precoUnitario,
          categoria: itemEditando.categoria || "",
        },
        itemEditando.categoria
      );
      Alert.alert("Sucesso", `${itemEditando.nome} atualizado com sucesso!`);
      setEditModalVisible(false);
      setItemEditando(null);
    } catch (error) {
      Alert.alert(
        "Erro",
        `Falha ao atualizar ${itemEditando.nome}: ${error.message}`
      );
    }
  };

  const handleRemoverItemCompleto = async (itemId, nome, categoriaItem) => {
    const mensagem = !categoriaItem
      ? `Deseja remover ${nome} apenas do estoque?`
      : `Deseja remover completamente ${nome} do estoque e do cardápio?`;

    showConfirmModal(mensagem, async () => {
      try {
        if (!categoriaItem) {
          const db = await waitForFirebaseInit();
          await db.ref(`estoque/${itemId}`).remove();
          Alert.alert("Sucesso", `${nome} removido do estoque`);
        } else {
          await removerItemEstoqueECardapio(itemId, categoriaItem);
          Alert.alert("Sucesso", `${nome} removido do estoque e cardápio!`);
        }
      } catch (error) {
        Alert.alert(
          "Erro",
          `Não foi possível remover ${nome}: ${error.message}`
        );
      }
      setConfirmModalVisible(false);
    });
  };

  const showConfirmModal = (message, action) => {
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setConfirmModalVisible(true);
  };

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <Text style={styles.itemText}>
        {item.nome} - {item.quantidade} {item.unidade} - R$
        {item.precoUnitario?.toFixed(2) || "0.00"}{" "}
        {item.categoria ? `(${item.categoria})` : ""}
      </Text>
      <View style={styles.actions}>
        <Button
          title="Editar"
          onPress={() => handleEditarItem(item)}
          color="#007bff"
        />
        <Button
          title="Remover"
          onPress={() =>
            handleRemoverItemCompleto(item.id, item.nome, item.categoria)
          }
          color="#dc3545"
        />
      </View>
    </View>
  );

  const filteredEstoque = estoque.filter((item) =>
    removerAcentos((item?.nome || "").toLowerCase()).includes(
      removerAcentos(searchText.toLowerCase())
    )
  );

  function removerAcentos(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  return (
    <>
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.titulo}>Controle de Estoque</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar item"
              value={searchText}
              onChangeText={setSearchText}
            />
            <FlatList
              data={filteredEstoque}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              style={styles.flatList}
              ListEmptyComponent={<Text>Sem itens no estoque</Text>}
            />
            <View style={styles.botoes}>
              <Button title="Fechar" onPress={onClose} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.titulo}>Editar Item</Text>
            {itemEditando && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Nome"
                  value={itemEditando.nome}
                  onChangeText={(text) =>
                    setItemEditando({ ...itemEditando, nome: text })
                  }
                />
                <TextInput
                  style={styles.input}
                  placeholder="Quantidade"
                  value={itemEditando.quantidade}
                  keyboardType="numeric"
                  onChangeText={(text) =>
                    setItemEditando({ ...itemEditando, quantidade: text })
                  }
                />
                <TextInput
                  style={styles.input}
                  placeholder="Unidade (ex: unidades, kg)"
                  value={itemEditando.unidade}
                  onChangeText={(text) =>
                    setItemEditando({ ...itemEditando, unidade: text })
                  }
                />
                <TextInput
                  style={styles.input}
                  placeholder="Preço (ex: 5.50)"
                  value={itemEditando.precoUnitario} // Já é string aqui
                  keyboardType="numeric"
                  onChangeText={(text) =>
                    setItemEditando({ ...itemEditando, precoUnitario: text })
                  }
                />
                <TextInput
                  style={styles.input}
                  placeholder="Categoria"
                  value={itemEditando.categoria}
                  onChangeText={(text) =>
                    setItemEditando({ ...itemEditando, categoria: text })
                  }
                />
                <View style={styles.botoes}>
                  <Button
                    title="Cancelar"
                    onPress={() => setEditModalVisible(false)}
                    color="#ff4444"
                  />
                  <Button
                    title="Salvar"
                    onPress={handleSalvarEdicao}
                    color="#28a745"
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={confirmModalVisible} transparent animationType="none">
        <View style={styles.confirmModalContainer}>
          <Animated.View
            style={[styles.confirmModalOverlay, { opacity: fadeAnim }]}
          />
          <Animated.View
            style={[
              styles.confirmModalContent,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            <Text style={styles.confirmModalText}>{confirmMessage}</Text>
            <View style={styles.confirmModalButtons}>
              <TouchableOpacity
                style={styles.confirmButtonCancel}
                onPress={() => setConfirmModalVisible(false)}
              >
                <Text style={styles.confirmButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButtonConfirm}
                onPress={() => confirmAction && confirmAction()}
              >
                <Text style={styles.confirmButtonText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
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
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    width: 350,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 10,
  },
  titulo: {
    fontSize: 20,
    marginBottom: 10,
    textAlign: "center",
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  flatList: {
    maxHeight: 400,
  },
  item: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  itemText: {
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    marginBottom: 10,
    borderRadius: 5,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  botoes: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
  },
  confirmModalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 0, 0, 0.5)",
  },
  confirmModalContent: {
    width: 300,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 10,
    alignItems: "center",
  },
  confirmModalText: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 20,
  },
  confirmModalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  confirmButtonCancel: {
    backgroundColor: "#ff4444",
    padding: 10,
    borderRadius: 5,
    flex: 1,
    marginRight: 10,
    alignItems: "center",
  },
  confirmButtonConfirm: {
    backgroundColor: "#28a745",
    padding: 10,
    borderRadius: 5,
    flex: 1,
    alignItems: "center",
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
