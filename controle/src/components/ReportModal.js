import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Modal,
  StyleSheet,
  FlatList,
  Alert,
} from "react-native";
import {
  getCashFlowReport,
  getCashFlowMovementsReport,
} from "../services/firebase";
import { Picker } from "@react-native-picker/picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

const ReportModal = ({ visible, onClose }) => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("");
  const [report, setReport] = useState(null);
  const [movementsReport, setMovementsReport] = useState(null);
  const [error, setError] = useState("");

  const handleGenerateReport = async () => {
    try {
      setError("");
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        setError("Insira datas no formato YYYY-MM-DD.");
        return;
      }

      const start = new Date(`${startDate}T00:00:00.000-03:00`);
      const end = new Date(`${endDate}T23:59:59.999-03:00`);
      console.log("Datas enviadas:", {
        startDate,
        endDate,
        start: start.toISOString(),
        end: end.toISOString(),
      });

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        setError("Por favor, insira datas válidas (YYYY-MM-DD).");
        return;
      }
      if (start > end) {
        setError("A data inicial deve ser anterior à data final.");
        return;
      }

      const cashFlowReport = await getCashFlowReport(start, end);
      const movementsReport = await getCashFlowMovementsReport(
        start,
        end,
        typeFilter || null,
        paymentMethodFilter || null
      );
      setReport(cashFlowReport);
      setMovementsReport(movementsReport);
    } catch (err) {
      setError("Erro ao gerar relatório: " + err.message);
      console.error("Error generating report:", err);
    }
  };

  const handleExportCSV = async () => {
    if (!report || !movementsReport) {
      Alert.alert("Erro", "Gere um relatório antes de exportar.");
      return;
    }

    try {
      // Formatar cabeçalhos e dados do CSV
      const csvRows = [];

      // Seção de Caixas
      csvRows.push("Relatório de Caixas");
      csvRows.push(
        "ID,Operador,Data Abertura,Status,Valor Inicial,Valor Final,Dinheiro,Cartão,Pix,Observações"
      );
      report.cashFlows.forEach((cashFlow) => {
        csvRows.push(
          [
            cashFlow.id,
            cashFlow.operatorName,
            new Date(cashFlow.openDate).toLocaleString("pt-BR"),
            cashFlow.status,
            cashFlow.openAmount.toFixed(2),
            cashFlow.closeAmount?.toFixed(2) || "N/A",
            cashFlow.cashPayments.toFixed(2),
            cashFlow.cardPayments.toFixed(2),
            cashFlow.pixPayments.toFixed(2),
            cashFlow.observations || "",
          ]
            .map((val) => `"${val}"`)
            .join(",")
        );
      });

      // Totais de Caixas
      csvRows.push("");
      csvRows.push("Totais de Caixas");
      csvRows.push(
        `Total Dinheiro,${report.totalCash.toFixed(2)}`,
        `Total Cartão,${report.totalCard.toFixed(2)}`,
        `Total Pix,${report.totalPix.toFixed(2)}`
      );

      // Seção de Movimentações
      csvRows.push("");
      csvRows.push("Relatório de Movimentações");
      csvRows.push("ID,Caixa ID,Tipo,Valor,Método de Pagamento,Descrição,Data");
      movementsReport.movements.forEach((movement) => {
        csvRows.push(
          [
            movement.id,
            movement.cashFlowId,
            movement.type === "entry" ? "Entrada" : "Saída",
            movement.amount.toFixed(2),
            movement.paymentMethod || "N/A",
            movement.description,
            new Date(movement.date).toLocaleString("pt-BR"),
          ]
            .map((val) => `"${val}"`)
            .join(",")
        );
      });

      // Totais de Movimentações
      csvRows.push("");
      csvRows.push("Totais de Movimentações");
      csvRows.push(
        `Total Entradas,${movementsReport.totalEntries.toFixed(2)}`,
        `Total Saídas,${movementsReport.totalExits.toFixed(2)}`,
        `Saldo,${movementsReport.balance.toFixed(2)}`,
        `Total Dinheiro,${movementsReport.totalCash.toFixed(2)}`,
        `Total Cartão,${movementsReport.totalCard.toFixed(2)}`,
        `Total Pix,${movementsReport.totalPix.toFixed(2)}`
      );

      // Gerar conteúdo do CSV
      const csvContent = csvRows.join("\n");

      // Definir caminho do arquivo
      const fileName = `Relatorio_${startDate}_${endDate}.csv`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      // Escrever arquivo
      await FileSystem.writeAsStringAsync(filePath, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Verificar se o compartilhamento está disponível
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          "Erro",
          "Compartilhamento não disponível neste dispositivo."
        );
        return;
      }

      // Compartilhar arquivo
      await Sharing.shareAsync(filePath, {
        mimeType: "text/csv",
        dialogTitle: "Compartilhar Relatório Financeiro",
        UTI: "public.comma-separated-values-text",
      });

      Alert.alert("Sucesso", `Relatório exportado como ${fileName}`);
    } catch (error) {
      console.error("Erro ao exportar CSV:", error);
      Alert.alert("Erro", "Falha ao exportar o relatório: " + error.message);
    }
  };

  const renderCashFlowItem = ({ item }) => (
    <View style={styles.cashFlowItem}>
      <Text style={styles.cashFlowText}>ID: {item.id}</Text>
      <Text style={styles.cashFlowText}>Operador: {item.operatorName}</Text>
      <Text style={styles.cashFlowText}>
        Valor Inicial: R$ {item.openAmount.toFixed(2)}
      </Text>
      <Text style={styles.cashFlowText}>
        Valor Final: R$ {item.closeAmount?.toFixed(2) || "N/A"}
      </Text>
    </View>
  );

  const renderMovementItem = ({ item }) => (
    <View style={styles.movementItem}>
      <Text style={styles.itemText}>
        {item.type === "entry" ? "Entrada" : "Saída"}: R${" "}
        {item.amount.toFixed(2)}
      </Text>
      <Text style={styles.itemText}>Método: {item.paymentMethod || "N/A"}</Text>
      <Text style={styles.itemText}>Descrição: {item.description}</Text>
      <Text style={styles.itemText}>
        Data: {new Date(item.date).toLocaleString("pt-BR")}
      </Text>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Gerar Relatório</Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <TextInput
            style={styles.input}
            placeholder="Data Inicial (YYYY-MM-DD)"
            value={startDate}
            onChangeText={setStartDate}
            placeholderTextColor="#888"
          />
          <TextInput
            style={styles.input}
            placeholder="Data Final (YYYY-MM-DD)"
            value={endDate}
            onChangeText={setEndDate}
            placeholderTextColor="#888"
          />
          <Picker
            selectedValue={typeFilter}
            style={styles.picker}
            onValueChange={(value) => setTypeFilter(value)}
          >
            <Picker.Item label="Todos os Tipos" value="" />
            <Picker.Item label="Entrada" value="entry" />
            <Picker.Item label="Saída" value="exit" />
          </Picker>
          <Picker
            selectedValue={paymentMethodFilter}
            style={styles.picker}
            onValueChange={(value) => setPaymentMethodFilter(value)}
          >
            <Picker.Item label="Todos os Métodos" value="" />
            <Picker.Item label="Dinheiro" value="cash" />
            <Picker.Item label="Cartão" value="card" />
            <Picker.Item label="Pix" value="pix" />
          </Picker>
          <Button
            title="Gerar Relatório"
            onPress={handleGenerateReport}
            color="#FFA500"
          />
          {report && movementsReport && (
            <View style={styles.reportContainer}>
              <Text style={styles.reportTitle}>Resumo do Relatório</Text>
              <Text style={styles.reportText}>
                Total Entradas: R$ {movementsReport.totalEntries.toFixed(2)}
              </Text>
              <Text style={styles.reportText}>
                Total Saídas: R$ {movementsReport.totalExits.toFixed(2)}
              </Text>
              <Text style={styles.reportText}>
                Saldo: R$ {movementsReport.balance.toFixed(2)}
              </Text>
              <Text style={styles.reportText}>
                Total em Dinheiro: R$ {movementsReport.totalCash.toFixed(2)}
              </Text>
              <Text style={styles.reportText}>
                Total em Cartão: R$ {movementsReport.totalCard.toFixed(2)}
              </Text>
              <Text style={styles.reportText}>
                Total em Pix: R$ {movementsReport.totalPix.toFixed(2)}
              </Text>
              <Button
                title="Exportar como CSV"
                onPress={handleExportCSV}
                color="#4CAF50"
              />
              <Text style={styles.reportTitle}>Caixas</Text>
              <FlatList
                data={report.cashFlows}
                renderItem={renderCashFlowItem}
                keyExtractor={(item) => item.id}
                style={styles.cashFlowList}
              />
              <Text style={styles.reportTitle}>Movimentações</Text>
              <FlatList
                data={movementsReport.movements}
                renderItem={renderMovementItem}
                keyExtractor={(item) => item.id}
                style={styles.movementsList}
              />
            </View>
          )}
          <Button title="Fechar" onPress={onClose} color="#FF4444" />
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
  reportContainer: {
    marginTop: 20,
    width: "100%",
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    marginTop: 10,
    color: "#5C4329",
  },
  reportText: {
    fontSize: 14,
    marginBottom: 5,
    color: "#000",
  },
  cashFlowList: {
    maxHeight: 150,
    marginBottom: 10,
  },
  cashFlowItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  cashFlowText: {
    fontSize: 14,
    color: "#000",
  },
  movementsList: {
    maxHeight: 150,
  },
  movementItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  itemText: {
    fontSize: 14,
    color: "#000",
  },
});

export default ReportModal;
