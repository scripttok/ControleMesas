import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  Button,
  Alert,
  ScrollView,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import {
  adicionarNovoItemEstoque,
  adicionarNovoItemCardapio,
} from "../services/mesaService";
import { waitForFirebaseInit } from "../services/firebase";

export default function GerenciarEstoqueCardapioModal({ visible, onClose }) {
  // Campos unificados para estoque e cardápio
  const [nomeEstoque, setNomeEstoque] = useState("");
  const [quantidadeEstoque, setQuantidadeEstoque] = useState("");
  const [unidadeEstoque, setUnidadeEstoque] = useState("");
  const [estoqueMinimo, setEstoqueMinimo] = useState("");
  const [precoUnitario, setPrecoUnitario] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");

  // Lista de categorias existentes
  const categorias = [
    "Cervejas",
    "Bebidas Garrafas",
    "Refrigerantes",
    "Salgados e Porções ",
    "Águas, Sucos e Outros",
    "Combos",
    "Docês",
  ];
  const handleAdicionarEstoqueECardapio = async () => {
    if (!nomeEstoque || !quantidadeEstoque || !precoUnitario || !categoria) {
      Alert.alert(
        "Erro",
        "Nome, quantidade, preço unitário e categoria são obrigatórios."
      );
      return;
    }

    const nomeLimpo = nomeEstoque.trim().toLowerCase(); // Normalizar para minúsculas
    if (!nomeLimpo) {
      Alert.alert("Erro", "O nome do item não pode ser vazio.");
      return;
    }

    try {
      "(NOBRIDGE) LOG Iniciando processo de adição:",
        {
          nomeLimpo,
          quantidadeEstoque,
          precoUnitario,
          categoria,
          descricao,
        };

      const chaveUnica = `${categoria.slice(0, 3)}${Date.now()}`;

      // Adicionar ao estoque com categoria e preço
      const db = await waitForFirebaseInit();
      const itemEstoque = {
        nome: nomeLimpo,
        quantidade: parseInt(quantidadeEstoque, 10),
        unidade: unidadeEstoque || "unidades",
        estoqueMinimo: parseInt(estoqueMinimo, 10) || 0,
        precoUnitario: parseFloat(precoUnitario),
        chaveCardapio: chaveUnica,
        categoria: categoria,
      };
      await db.ref(`estoque/${nomeLimpo}`).set(itemEstoque); // Usar nomeLimpo como chave
      ("(NOBRIDGE) LOG Estoque adicionado com sucesso");

      // Adicionar ao cardápio com a descrição
      await adicionarNovoItemCardapio(
        nomeLimpo,
        precoUnitario,
        "",
        categoria,
        chaveUnica,
        descricao
      );
      ("(NOBRIDGE) LOG Cardápio adicionado com sucesso");

      Alert.alert(
        "Sucesso",
        `${nomeLimpo} adicionado ao estoque e ao cardápio em ${categoria}!`
      );

      setNomeEstoque("");
      setQuantidadeEstoque("");
      setUnidadeEstoque("");
      setEstoqueMinimo("");
      setPrecoUnitario("");
      setCategoria("");
      setDescricao("");
    } catch (error) {
      console.error("(NOBRIDGE) ERROR Erro no processo de adição:", error);
      Alert.alert("Erro", "Não foi possível adicionar: " + error.message);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.modalContent}>
            <Text style={styles.titulo}>Gerenciar Estoque e Cardápio</Text>

            {/* Seção unificada para adicionar ao estoque e cardápio */}
            <Text style={styles.subtitulo}>
              Adicionar ao Estoque e Cardápio
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Nome do item (ex.: Cerveja)"
              placeholderTextColor="#000"
              value={nomeEstoque}
              onChangeText={setNomeEstoque}
            />
            <TextInput
              style={styles.input}
              placeholder="Quantidade (ex.: 10)"
              placeholderTextColor="#000"
              value={quantidadeEstoque}
              keyboardType="numeric"
              onChangeText={setQuantidadeEstoque}
            />
            <TextInput
              style={styles.input}
              placeholder="Unidade (ex.: unidades)"
              placeholderTextColor="#000"
              value={unidadeEstoque}
              onChangeText={setUnidadeEstoque}
            />
            <TextInput
              style={styles.input}
              placeholder="Descrição (ex.: Lata 350ml)"
              placeholderTextColor="#000"
              value={descricao}
              onChangeText={setDescricao}
            />
            <TextInput
              style={styles.input}
              placeholder="Estoque Mínimo (ex.: 2)"
              placeholderTextColor="#000"
              value={estoqueMinimo}
              keyboardType="numeric"
              onChangeText={setEstoqueMinimo}
            />
            <TextInput
              style={styles.input}
              placeholder="Preço Unitário (ex.: 5.00)"
              placeholderTextColor="#000"
              value={precoUnitario}
              keyboardType="numeric"
              onChangeText={setPrecoUnitario}
            />
            <Picker
              selectedValue={categoria}
              style={styles.picker}
              onValueChange={(itemValue) => setCategoria(itemValue)}
            >
              <Picker.Item label="Selecione uma categoria" value="" />
              {categorias.map((cat) => (
                <Picker.Item key={cat} label={cat} value={cat} />
              ))}
            </Picker>
            <Button
              title="Adicionar ao Estoque e Cardápio"
              onPress={handleAdicionarEstoqueECardapio}
              color="#28a745"
            />

            {/* Botão de fechar */}
            <View style={styles.botoes}>
              <Button title="Fechar" onPress={onClose} />
            </View>
          </View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
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
    fontWeight: "bold",
    marginVertical: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  picker: {
    height: 50,
    width: "100%",
    marginBottom: 10,
  },
  botoes: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
});
