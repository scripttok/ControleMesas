import React, { useState } from "react";
import { View, Text, TextInput, Button, Modal, StyleSheet } from "react-native";
import { openCashFlow } from "../services/firebase";

const OpenCashFlowModal = ({ visible, onClose, onSuccess }) => {
  const [operatorName, setOperatorName] = useState("");
  const [openAmount, setOpenAmount] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    try {
      setError("");
      if (!operatorName.trim()) {
        setError("O nome do operador é obrigatório.");
        return;
      }
      const amount = parseFloat(openAmount.replace(",", "."));
      if (isNaN(amount) || amount < 0) {
        setError("O valor inicial deve ser um número maior ou igual a 0.");
        return;
      }
      const cashFlowId = await openCashFlow(operatorName.trim(), amount);
      onSuccess(cashFlowId);
      setOperatorName("");
      setOpenAmount("");
      onClose();
    } catch (err) {
      setError("Erro ao abrir o caixa. Tente novamente.");
      console.error("Error opening cash flow:", err);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Abrir Caixa</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <TextInput
            style={styles.input}
            placeholder="Nome do Operador"
            value={operatorName}
            onChangeText={setOperatorName}
            placeholderTextColor="#888"
          />
          <TextInput
            style={styles.input}
            placeholder="Valor Inicial (R$)"
            value={openAmount}
            onChangeText={setOpenAmount}
            keyboardType="numeric"
            placeholderTextColor="#888"
          />
          <View style={styles.buttonContainer}>
            <Button title="Confirmar" onPress={handleSubmit} color="#FFA500" />
            <Button title="Cancelar" onPress={onClose} color="#FF4444" />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContainer: {
    width: "80%",
    padding: 20,
    backgroundColor: "#FFF",
    borderRadius: 10,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#5C4329",
  },
  input: {
    width: "100%",
    height: 40,
    borderColor: "#5C4329",
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 15,
    color: "#000",
  },
  errorText: {
    color: "red",
    marginBottom: 10,
    textAlign: "center",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
});

export default OpenCashFlowModal;
