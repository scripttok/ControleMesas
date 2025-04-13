import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Button,
  TextInput,
  Alert,
} from "react-native";
import { adicionarFichaTecnica } from "../services/mesaService";

export default function GerenciarFichasTecnicasModal({ visible, onClose }) {
  const [novoItemCardapio, setNovoItemCardapio] = useState("");
  const [novoItemEstoque, setNovoItemEstoque] = useState("");
  const [quantidadePorUnidade, setQuantidadePorUnidade] = useState("");

  const handleAdicionarFicha = async () => {
    if (
      !novoItemCardapio.trim() ||
      !novoItemEstoque.trim() ||
      !quantidadePorUnidade.trim()
    ) {
      Alert.alert("Erro", "Todos os campos são obrigatórios.");
      return;
    }
    const qtd = parseFloat(quantidadePorUnidade);
    if (isNaN(qtd) || qtd <= 0) {
      Alert.alert("Erro", "Digite uma quantidade válida maior que 0.");
      return;
    }
    try {
      await adicionarFichaTecnica(
        novoItemCardapio.trim(),
        novoItemEstoque.trim(),
        qtd
      );
      Alert.alert(
        "Sucesso",
        `Ficha técnica para ${novoItemCardapio} adicionada!`
      );
      setNovoItemCardapio("");
      setNovoItemEstoque("");
      setQuantidadePorUnidade("");
    } catch (error) {
      Alert.alert(
        "Erro",
        `Não foi possível adicionar a ficha técnica: ${error.message}`
      );
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.titulo}>Adicionar Ficha Técnica</Text>
          <Text style={styles.subtitulo}>Preencha os campos abaixo:</Text>
          <TextInput
            style={styles.input}
            placeholder="Item do Cardápio (ex.: Suco de laranja)"
            value={novoItemCardapio}
            onChangeText={setNovoItemCardapio}
          />
          <TextInput
            style={styles.input}
            placeholder="Item do Estoque (ex.: Suco de laranja)"
            value={novoItemEstoque}
            onChangeText={setNovoItemEstoque}
          />
          <TextInput
            style={styles.input}
            placeholder="Quantidade por Unidade (ex.: 1)"
            value={quantidadePorUnidade}
            keyboardType="numeric"
            onChangeText={setQuantidadePorUnidade}
          />
          <View style={styles.botoes}>
            <Button
              title="Adicionar"
              onPress={handleAdicionarFicha}
              color="#28a745"
            />
            <Button title="Fechar" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
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
  subtitulo: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    marginBottom: 10,
    borderRadius: 5,
    width: "100%",
  },
  botoes: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
});
