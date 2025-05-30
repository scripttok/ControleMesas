import React, { useState } from "react";
import { View, Text, TextInput, Button, Modal, StyleSheet } from "react-native";
import { addCashFlowMovement } from "../services/firebase";
import { Picker } from "@react-native-picker/picker";

const AddMovementModal = ({ visible, onClose, cashFlowId, onSuccess }) => {
  const [type, setType] = useState("entry");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    try {
      setError("");
      const amountValue = parseFloat(amount.replace(",", "."));
      if (isNaN(amountValue) || amountValue <= 0) {
        setError("O valor deve ser um número maior que 0.");
        return;
      }
      if (!description.trim()) {
        setError("A descrição é obrigatória.");
        return;
      }
      await addCashFlowMovement(
        cashFlowId,
        type,
        amountValue,
        type === "entry" ? paymentMethod : null,
        description.trim()
      );
      onSuccess();
      setAmount("");
      setPaymentMethod("");
      setDescription("");
      setType("entry");
      onClose();
    } catch (err) {
      setError("Erro ao registrar movimentação. Tente novamente.");
      console.error("Error adding movement:", err);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>
            Registrar {type === "entry" ? "Entrada" : "Saída"}
          </Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Picker
            selectedValue={type}
            style={styles.picker}
            onValueChange={(value) => setType(value)}
          >
            <Picker.Item label="Entrada" value="entry" />
            <Picker.Item label="Saída" value="exit" />
          </Picker>
          <TextInput
            style={styles.input}
            placeholder="Valor (R$)"
            placeholderTextColor="#000"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />
          {type === "entry" && (
            <Picker
              selectedValue={paymentMethod}
              style={styles.picker}
              onValueChange={(value) => setPaymentMethod(value)}
            >
              <Picker.Item label="Selecione o método" value="" />
              <Picker.Item label="Dinheiro" value="cash" />
              <Picker.Item label="Cartão" value="card" />
              <Picker.Item label="Pix" value="pix" />
            </Picker>
          )}
          <TextInput
            style={styles.input}
            placeholder="Descrição"
            placeholderTextColor="#000"
            value={description}
            onChangeText={setDescription}
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
  picker: {
    width: "100%",
    height: 40,
    marginBottom: 15,
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

export default AddMovementModal;
