import { Alert } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";

export const printOrder = async (order) => {
  try {
    // Formatar o HTML para impressão (baseado no ReportModal.js)
    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: monospace; font-size: 12px; width: 80mm; }
            h1 { font-size: 16px; text-align: center; }
            p { margin: 5px 0; }
            .section { margin-bottom: 10px; }
            .line { border-bottom: 1px dashed #000; margin: 5px 0; }
            .row { display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <h1>Pedido Delivery</h1>
          <div class="section">
            <p>Cliente: ${order.client.name}</p>
            <p>Telefone: ${order.client.phone}</p>
            <p>CPF: ${order.client.cpf || "N/A"}</p>
            <p>Endereço: ${order.delivery.address}, ${
      order.delivery.neighborhood
    }</p>
            <p>Referência: ${order.delivery.reference || "N/A"}</p>
            <p>Método: ${order.delivery.method}</p>
          </div>
          <div class="line"></div>
          <div class="section">
            <h2>Itens</h2>
            ${order.items
              .map(
                (item) => `
                  <div class="row">
                    <p>${item.name} x${item.orderQuantity}</p>
                    <p>R$ ${(item.price * item.orderQuantity).toFixed(2)}</p>
                  </div>
                `
              )
              .join("")}
          </div>
          <div class="line"></div>
          <div class="section">
            <p>Total: R$ ${order.total.toFixed(2)}</p>
            <p>Data: ${new Date(order.createdAt).toLocaleString("pt-BR")}</p>
          </div>
        </body>
      </html>
    `;

    // Gerar PDF
    const { uri } = await Print.printToFileAsync({
      html: htmlContent,
      width: 576, // 80mm at 72dpi (padrão para impressoras térmicas)
    });

    // Salvar no diretório de cache
    const fileName = `Pedido_Delivery_${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`;
    const printFolder = `${FileSystem.cacheDirectory}auto_print/`;
    const filePath = `${printFolder}${fileName}`;

    // Criar pasta auto_print, se não existir
    await FileSystem.makeDirectoryAsync(printFolder, { intermediates: true });

    // Mover o PDF para a pasta
    await FileSystem.moveAsync({
      from: uri,
      to: filePath,
    });

    // Compartilhar com RawBT Print Service
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert("Erro", "Compartilhamento não disponível neste dispositivo.");
      return false;
    }

    await Sharing.shareAsync(filePath, {
      mimeType: "application/pdf",
      dialogTitle: "Imprimir Pedido",
    });

    Alert.alert(
      "Sucesso",
      "Pedido gerado. Selecione RawBT Print Service para imprimir."
    );
    return true;
  } catch (error) {
    console.error("Erro ao imprimir pedido:", error);
    Alert.alert(
      "Erro",
      "Falha ao gerar o pedido para impressão: " + error.message
    );
    return false;
  }
};
