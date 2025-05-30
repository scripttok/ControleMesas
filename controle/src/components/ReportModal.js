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
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import {
  getCashFlowReport,
  getCashFlowMovementsReport,
} from "../services/firebase";
import { Picker } from "@react-native-picker/picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";

const ReportModal = ({ visible, onClose }) => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("");
  const [report, setReport] = useState(null);
  const [movementsReport, setMovementsReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerateReport = async () => {
    try {
      setError("");
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    if (!report || !movementsReport) {
      Alert.alert("Erro", "Gere um relatório antes de exportar.");
      return;
    }

    try {
      const csvRows = [];
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

      csvRows.push("");
      csvRows.push("Totais de Caixas");
      csvRows.push(
        `Total Dinheiro,${report.totalCash.toFixed(2)}`,
        `Total Cartão,${report.totalCard.toFixed(2)}`,
        `Total Pix,${report.totalPix.toFixed(2)}`
      );

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

      const csvContent = csvRows.join("\n");
      const fileName = `Relatorio_${startDate}_${endDate}.csv`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          "Erro",
          "Compartilhamento não disponível neste dispositivo."
        );
        return;
      }

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

  const handlePrintReport = async () => {
    if (!report || !movementsReport) {
      Alert.alert("Erro", "Gere um relatório antes de imprimir.");
      return;
    }

    try {
      setLoading(true);

      // Generate HTML for printing
      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: monospace; font-size: 12px; width: 80mm; }
              h1 { font-size: 16px; text-align: center; }
              h2 { font-size: 14px; margin-top: 10px; }
              p { margin: 5px 0; }
              .section { margin-bottom: 10px; }
              .line { border-bottom: 1px dashed #000; margin: 5px 0; }
              .row { display: flex; justify-content: space-between; }
            </style>
          </head>
          <body>
            <h1>Relatório Financeiro</h1>
            <div class="section">
              <h2>Resumo</h2>
              <p>Total Entradas: R$ ${movementsReport.totalEntries.toFixed(
                2
              )}</p>
              <p>Total Saídas: R$ ${movementsReport.totalExits.toFixed(2)}</p>
              <p>Saldo: R$ ${movementsReport.balance.toFixed(2)}</p>
              <p>Total Dinheiro: R$ ${movementsReport.totalCash.toFixed(2)}</p>
              <p>Total Cartão: R$ ${movementsReport.totalCard.toFixed(2)}</p>
              <p>Total Pix: R$ ${movementsReport.totalPix.toFixed(2)}</p>
            </div>
            <div class="line"></div>
            <div class="section">
              <h2>Caixas</h2>
              ${report.cashFlows
                .map(
                  (item) => `
                    <div class="row">
                      <p>ID: ${item.id}</p>
                      <p>Operador: ${item.operatorName}</p>
                    </div>
                    <p>Valor Inicial: R$ ${item.openAmount.toFixed(2)}</p>
                    <p>Valor Final: R$ ${
                      item.closeAmount?.toFixed(2) || "N/A"
                    }</p>
                  `
                )
                .join("<div class='line'></div>")}
            </div>
            <div class="line"></div>
            <div class="section">
              <h2>Movimentações</h2>
              ${movementsReport.movements
                .map(
                  (item) => `
                    <div class="row">
                      <p>${
                        item.type === "entry" ? "Entrada" : "Saída"
                      }: R$ ${item.amount.toFixed(2)}</p>
                      <p>Método: ${item.paymentMethod || "N/A"}</p>
                    </div>
                    <p>Descrição: ${item.description}</p>
                    <p>Data: ${new Date(item.date).toLocaleString("pt-BR")}</p>
                  `
                )
                .join("<div class='line'></div>")}
            </div>
          </body>
        </html>
      `;

      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        width: 576, // 80mm at 72dpi (standard for thermal printers)
      });

      // Save to cache directory
      const fileName = `Relatorio_${startDate}_${endDate}.pdf`;
      const printFolder = `${FileSystem.cacheDirectory}auto_print/`;
      const filePath = `${printFolder}${fileName}`;

      // Ensure the auto_print folder exists
      await FileSystem.makeDirectoryAsync(printFolder, { intermediates: true });

      // Move the PDF to the auto_print folder
      await FileSystem.moveAsync({
        from: uri,
        to: filePath,
      });

      // Share the PDF with RawBT Print Service
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(
          "Erro",
          "Compartilhamento não disponível neste dispositivo."
        );
        return;
      }

      await Sharing.shareAsync(filePath, {
        mimeType: "application/pdf",
        dialogTitle: "Imprimir Relatório",
      });

      Alert.alert(
        "Sucesso",
        `Relatório gerado. Selecione RawBT Print Service para imprimir.`
      );
    } catch (error) {
      console.error("Erro ao imprimir relatório:", error);
      Alert.alert(
        "Erro",
        "Falha ao gerar o relatório para impressão: " + error.message
      );
    } finally {
      setLoading(false);
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

  const renderModalContent = () => (
    <View style={styles.contentContainer}>
      <Text style={styles.modalTitle}>Gerar Relatório</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading && <ActivityIndicator size="large" color="#FFA500" />}

      <Text style={styles.label}>Data Inicial (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 2025-05-04"
        placeholderTextColor="#000"
        value={startDate}
        onChangeText={setStartDate}
      />
      <Text style={styles.label}>Data Final (YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 2025-05-04"
        placeholderTextColor="#000"
        value={endDate}
        onChangeText={setEndDate}
      />

      <Text style={styles.label}>Tipo de Movimentação</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={typeFilter}
          style={styles.picker}
          onValueChange={(value) => setTypeFilter(value)}
        >
          <Picker.Item label="Todos os Tipos" value="" />
          <Picker.Item label="Entrada" value="entry" />
          <Picker.Item label="Saída" value="exit" />
        </Picker>
      </View>

      <Text style={styles.label}>Método de Pagamento</Text>
      <View style={styles.pickerContainer}>
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
      </View>

      <TouchableOpacity
        style={[styles.button, styles.generateButton]}
        onPress={handleGenerateReport}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Gerando..." : "Gerar Relatório"}
        </Text>
      </TouchableOpacity>

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

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.exportButton, styles.buttonHalf]}
              onPress={handleExportCSV}
            >
              <Text style={styles.buttonText}>Exportar como CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.printButton, styles.buttonHalf]}
              onPress={handlePrintReport}
            >
              <Text style={styles.buttonText}>Imprimir</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.reportTitle}>Caixas</Text>
          {report.cashFlows.map((item) => (
            <View key={item.id}>{renderCashFlowItem({ item })}</View>
          ))}

          <Text style={styles.reportTitle}>Movimentações</Text>
          {movementsReport.movements.map((item) => (
            <View key={item.id}>{renderMovementItem({ item })}</View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <FlatList
            data={[{}]}
            renderItem={renderModalContent}
            keyExtractor={() => "modal-content"}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.flatListContent}
          />
          <TouchableOpacity
            style={[styles.button, styles.closeButton]}
            onPress={onClose}
          >
            <Text style={styles.buttonText}>Fechar</Text>
          </TouchableOpacity>
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
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  modalContainer: {
    width: "90%",
    maxHeight: "80%",
    backgroundColor: "#FFF",
    borderRadius: 12,
    overflow: "hidden",
  },
  flatListContent: {
    padding: 20,
    paddingBottom: 20,
  },
  contentContainer: {
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#333",
    textAlign: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 5,
  },
  input: {
    width: "100%",
    height: 44,
    borderColor: "#CCC",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 15,
    backgroundColor: "#F9F9F9",
    color: "#333",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#CCC",
    borderRadius: 8,
    marginBottom: 15,
    backgroundColor: "#F9F9F9",
  },
  picker: {
    width: "100%",
    height: 44,
    color: "#red",
  },
  errorText: {
    color: "#D32F2F",
    marginBottom: 10,
    textAlign: "center",
    fontSize: 14,
  },
  button: {
    width: "100%",
    height: 44,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 5,
  },
  generateButton: {
    backgroundColor: "#FFA500",
  },
  exportButton: {
    backgroundColor: "#4CAF50",
  },
  printButton: {
    backgroundColor: "#2196F3",
  },
  closeButton: {
    backgroundColor: "#FF4444",
    margin: 10,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  buttonHalf: {
    width: "48%",
  },
  reportContainer: {
    marginTop: 15,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginVertical: 10,
    color: "#333",
  },
  reportText: {
    fontSize: 14,
    marginBottom: 5,
    color: "#333",
  },
  cashFlowItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
    backgroundColor: "#F9F9F9",
    borderRadius: 6,
    marginBottom: 5,
  },
  cashFlowText: {
    fontSize: 14,
    color: "#333",
  },
  movementItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
    backgroundColor: "#F9F9F9",
    borderRadius: 6,
    marginBottom: 5,
  },
  itemText: {
    fontSize: 14,
    color: "#333",
  },
});

export default ReportModal;
