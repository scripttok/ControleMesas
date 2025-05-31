import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
} from "react-native";

export default function AdicionarMesaModal({ visible, onClose, onAdicionar }) {
  const [nomeCliente, setNomeCliente] = useState("");

  const handleAdicionar = async () => {
    console.log(
      "(NOBRIDGE) LOG AdicionarMesaModal - handleAdicionar - Nome do cliente:",
      nomeCliente
    );
    if (nomeCliente) {
      try {
        console.log("(NOBRIDGE) LOG AdicionarMesaModal - Chamando onAdicionar");
        await onAdicionar({ nomeCliente });
        console.log(
          "(NOBRIDGE) LOG AdicionarMesaModal - onAdicionar concluído"
        );
        Alert.alert("Sucesso", "Mesa adicionada com sucesso!", [
          {
            text: "OK",
            onPress: () => {
              setNomeCliente("");
              onClose();
            },
          },
        ]);
      } catch (error) {
        console.error(
          "(NOBRIDGE) ERROR AdicionarMesaModal - Erro ao adicionar:",
          error
        );
        Alert.alert(
          "Erro",
          `Não foi possível adicionar a mesa: ${error.message}`
        );
      }
    } else {
      console.log("(NOBRIDGE) LOG AdicionarMesaModal - Campos não preenchidos");
      Alert.alert("Erro", "Preencha todos os campos!");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.titulo}>Adicionar Mesa</Text>
          <TextInput
            style={styles.input}
            placeholder="Nome do Cliente"
            placeholderTextColor="#000"
            value={nomeCliente}
            onChangeText={setNomeCliente}
          />
          <View style={styles.botoes}>
            <Button title="Cancelar" onPress={onClose} color="#ff4444" />
            <Button title="Adicionar" onPress={handleAdicionar} />
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
    width: 300,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 10,
  },
  titulo: {
    fontSize: 20,
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  botoes: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
