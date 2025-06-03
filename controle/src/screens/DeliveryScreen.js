import React, { useState, useEffect, useCallback, memo, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Alert,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { collection, addDoc } from "firebase/firestore";
import { ref, get, update } from "firebase/database";
import { waitForFirebaseInit, db, database } from "../services/firebase";
import { printOrder } from "../services/printerService";
import Icon from "react-native-vector-icons/MaterialIcons";

// Wrapper para TextInput com rótulo
const FocusableTextInput = memo(
  ({
    style,
    label,
    placeholder,
    value,
    onChangeText,
    placeholderTextColor,
    keyboardType,
    returnKeyType,
    onFocus,
  }) => {
    console.log(`Rendering TextInput: ${placeholder}`);
    return (
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>{label}</Text>
        <TextInput
          style={[styles.input, style, value ? styles.inputActive : null]}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={placeholderTextColor}
          keyboardType={keyboardType}
          blurOnSubmit={false}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType={returnKeyType}
          onFocus={onFocus}
        />
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.value === nextProps.value &&
      prevProps.placeholder === nextProps.placeholder &&
      prevProps.keyboardType === nextProps.keyboardType &&
      prevProps.onChangeText === nextProps.onChangeText &&
      prevProps.returnKeyType === nextProps.returnKeyType &&
      prevProps.onFocus === nextProps.onFocus
    );
  }
);

// Componente de busca memoizado
const SearchBar = memo(
  ({ searchQuery, handleSearch, onInputFocus }) => {
    console.log("SearchBar render");
    return (
      <View style={styles.searchContainer}>
        <Icon name="search" size={24} color="#888" style={styles.searchIcon} />
        <FocusableTextInput
          label="Buscar Item"
          style={styles.searchInput}
          placeholder="Digite o nome do item"
          value={searchQuery}
          onChangeText={handleSearch}
          placeholderTextColor="#888"
          keyboardType="default"
          returnKeyType="none"
          onFocus={onInputFocus}
        />
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.searchQuery === nextProps.searchQuery &&
      prevProps.handleSearch === nextProps.handleSearch &&
      prevProps.onInputFocus === nextProps.onInputFocus
    );
  }
);

// Componente para Dados do Cliente
const ClientDataSection = memo(
  ({
    clientData,
    updateClientName,
    updateClientPhone,
    updateClientCpf,
    onInputFocus,
  }) => {
    console.log("ClientDataSection render");
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="person" size={28} color="#FF6F00" />
          <Text style={styles.sectionTitle}>Dados do Cliente</Text>
        </View>
        <FocusableTextInput
          label="Nome"
          placeholder="Nome completo"
          value={clientData.name}
          onChangeText={updateClientName}
          placeholderTextColor="#888"
          keyboardType="default"
          returnKeyType="next"
          onFocus={onInputFocus}
        />
        <FocusableTextInput
          label="Telefone"
          placeholder="(XX) XXXXX-XXXX"
          value={clientData.phone}
          onChangeText={updateClientPhone}
          placeholderTextColor="#888"
          keyboardType="phone-pad"
          returnKeyType="next"
          onFocus={onInputFocus}
        />
        <FocusableTextInput
          label="CPF (opcional)"
          placeholder="XXX.XXX.XXX-XX"
          value={clientData.cpf}
          onChangeText={updateClientCpf}
          placeholderTextColor="#888"
          keyboardType="numeric"
          returnKeyType="done"
          onFocus={onInputFocus}
        />
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.clientData.name === nextProps.clientData.name &&
      prevProps.clientData.phone === nextProps.clientData.phone &&
      prevProps.clientData.cpf === nextProps.clientData.cpf &&
      prevProps.updateClientName === nextProps.updateClientName &&
      prevProps.updateClientPhone === nextProps.updateClientPhone &&
      prevProps.updateClientCpf === nextProps.updateClientCpf &&
      prevProps.onInputFocus === nextProps.onInputFocus
    );
  }
);

// Componente para Dados de Entrega
const DeliveryDataSection = memo(
  ({
    deliveryData,
    updateDeliveryAddress,
    updateDeliveryNeighborhood,
    updateDeliveryReference,
    onInputFocus,
  }) => {
    console.log("DeliveryDataSection render");
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="location-on" size={28} color="#FF6F00" />
          <Text style={styles.sectionTitle}>Dados de Entrega</Text>
        </View>
        <FocusableTextInput
          label="Endereço"
          placeholder="Rua, número, complemento"
          value={deliveryData.address}
          onChangeText={updateDeliveryAddress}
          placeholderTextColor="#888"
          keyboardType="default"
          returnKeyType="next"
          onFocus={onInputFocus}
        />
        <FocusableTextInput
          label="Bairro"
          placeholder="Nome do bairro"
          value={deliveryData.neighborhood}
          onChangeText={updateDeliveryNeighborhood}
          placeholderTextColor="#888"
          keyboardType="default"
          returnKeyType="next"
          onFocus={onInputFocus}
        />
        <FocusableTextInput
          label="Ponto de Referência"
          placeholder="Ex.: Próximo à praça"
          value={deliveryData.reference}
          onChangeText={updateDeliveryReference}
          placeholderTextColor="#888"
          keyboardType="default"
          returnKeyType="done"
          onFocus={onInputFocus}
        />
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.deliveryData.address === nextProps.deliveryData.address &&
      prevProps.deliveryData.neighborhood ===
        nextProps.deliveryData.neighborhood &&
      prevProps.deliveryData.reference === nextProps.deliveryData.reference &&
      prevProps.updateDeliveryAddress === nextProps.updateDeliveryAddress &&
      prevProps.updateDeliveryNeighborhood ===
        nextProps.updateDeliveryNeighborhood &&
      prevProps.updateDeliveryReference === nextProps.updateDeliveryReference &&
      prevProps.onInputFocus === nextProps.onInputFocus
    );
  }
);

const DeliveryScreen = () => {
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [clientData, setClientData] = useState({
    name: "",
    phone: "",
    cpf: "",
  });
  const [deliveryData, setDeliveryData] = useState({
    address: "",
    neighborhood: "",
    reference: "",
    method: "Motoboy",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef(null);

  // Função para rolar até o campo focado
  const handleInputFocus = useCallback((event) => {
    if (scrollViewRef.current) {
      const inputY = event.nativeEvent.target.offsetTop || 0;
      scrollViewRef.current.scrollTo({ y: inputY - 100, animated: true });
    }
  }, []);

  // Callbacks estabilizados para atualizar clientData
  const updateClientName = useCallback((text) => {
    setClientData((prev) => ({ ...prev, name: text }));
  }, []);

  const updateClientPhone = useCallback((text) => {
    setClientData((prev) => ({ ...prev, phone: text }));
  }, []);

  const updateClientCpf = useCallback((text) => {
    setClientData((prev) => ({ ...prev, cpf: text }));
  }, []);

  // Callbacks estabilizados para atualizar deliveryData
  const updateDeliveryAddress = useCallback((text) => {
    setDeliveryData((prev) => ({ ...prev, address: text }));
  }, []);

  const updateDeliveryNeighborhood = useCallback((text) => {
    setDeliveryData((prev) => ({ ...prev, neighborhood: text }));
  }, []);

  const updateDeliveryReference = useCallback((text) => {
    setDeliveryData((prev) => ({ ...prev, reference: text }));
  }, []);

  useEffect(() => {
    const fetchStock = async () => {
      setLoading(true);
      setError("");
      try {
        console.log("Aguardando inicialização do Firebase...");
        await waitForFirebaseInit();
        console.log("Firebase inicializado, iniciando fetchStock...");

        const stockRef = ref(database, "estoque");
        const stockSnapshot = await get(stockRef);
        console.log(
          "Stock snapshot:",
          stockSnapshot.exists()
            ? "Dados encontrados"
            : "Nenhum dado encontrado"
        );

        if (!stockSnapshot.exists()) {
          setError("Nenhum item encontrado no estoque.");
          setItems([]);
          setFilteredItems([]);
          return;
        }

        const stockData = stockSnapshot.val();
        const stockList = Object.keys(stockData)
          .map((key) => {
            const item = stockData[key];
            console.log("Item:", key, item);
            return {
              id: key,
              name: item.nome,
              price: item.precoUnitario,
              quantity: item.quantidade,
              categoria: item.categoria,
              chaveCardapio: item.chaveCardapio,
              estoqueMinimo:
                item.estoqueMinimo !== undefined ? item.estoqueMinimo : 0,
              unidade: item.unidade,
            };
          })
          .filter(
            (item) => item.price !== undefined && item.quantity !== undefined
          );
        setItems(stockList);
        setFilteredItems(stockList);
      } catch (error) {
        console.error("Erro ao carregar estoque:", error);
        setError("Não foi possível carregar o estoque: " + error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStock();
  }, []);

  const handleSearch = useCallback(
    (query) => {
      setSearchQuery(query);
      if (query.trim() === "") {
        setFilteredItems(items);
      } else {
        const filtered = items.filter((item) =>
          item.name.toLowerCase().includes(query.toLowerCase())
        );
        setFilteredItems(filtered);
      }
    },
    [items]
  );

  const addItemToOrder = useCallback(
    (item) => {
      if (item.quantity <= 0) {
        setError("Item fora de estoque.");
        return;
      }
      const existingItem = selectedItems.find(
        (selected) => selected.id === item.id
      );
      if (existingItem) {
        setError("Item já adicionado. Altere a quantidade na lista abaixo.");
        return;
      }
      setSelectedItems([...selectedItems, { ...item, orderQuantity: 1 }]);
      setError("");
    },
    [selectedItems]
  );

  const updateItemQuantity = useCallback(
    (itemId, newQuantity) => {
      const quantity = parseInt(newQuantity, 10);
      if (isNaN(quantity) || quantity < 1) {
        setError("Quantidade deve ser um número maior que 0.");
        return;
      }

      const item = items.find((i) => i.id === itemId);
      if (!item) {
        setError("Item não encontrado no estoque.");
        return;
      }

      if (quantity > item.quantity) {
        setError(
          `Quantidade solicitada (${quantity}) excede o estoque disponível (${item.quantity}).`
        );
        return;
      }

      setSelectedItems(
        selectedItems.map((selected) =>
          selected.id === itemId
            ? { ...selected, orderQuantity: quantity }
            : selected
        )
      );
      setError("");
    },
    [items, selectedItems]
  );

  const incrementQuantity = useCallback(
    (itemId) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) {
        setError("Item não encontrado no estoque.");
        return;
      }

      setSelectedItems(
        selectedItems.map((selected) => {
          if (selected.id === itemId) {
            const newQuantity = selected.orderQuantity + 1;
            if (newQuantity > item.quantity) {
              setError(
                `Quantidade solicitada (${newQuantity}) excede o estoque disponível (${item.quantity}).`
              );
              return selected;
            }
            return { ...selected, orderQuantity: newQuantity };
          }
          return selected;
        })
      );
      setError("");
    },
    [items, selectedItems]
  );

  const decrementQuantity = useCallback(
    (itemId) => {
      setSelectedItems(
        selectedItems.map((selected) => {
          if (selected.id === itemId) {
            const newQuantity = selected.orderQuantity - 1;
            if (newQuantity < 1) {
              setError("Quantidade deve ser pelo menos 1.");
              return selected;
            }
            return { ...selected, orderQuantity: newQuantity };
          }
          return selected;
        })
      );
      setError("");
    },
    [selectedItems]
  );

  const removeItem = useCallback(
    (itemId) => {
      setSelectedItems(selectedItems.filter((item) => item.id !== itemId));
      setError("");
    },
    [selectedItems]
  );

  const confirmOrder = useCallback(async () => {
    if (
      !clientData.name ||
      !deliveryData.address ||
      selectedItems.length === 0
    ) {
      setError("Preencha todos os campos e selecione pelo menos um item.");
      return;
    }

    setLoading(true);
    try {
      console.log(
        "Aguardando inicialização do Firebase para confirmar pedido..."
      );
      await waitForFirebaseInit();
      console.log("Firebase inicializado, confirmando pedido...");

      const order = {
        client: clientData,
        delivery: deliveryData,
        items: selectedItems,
        total: selectedItems.reduce(
          (sum, item) => sum + item.price * item.orderQuantity,
          0
        ),
        createdAt: new Date(),
        status: "Pendente",
      };
      console.log("Salvando pedido:", order);
      const orderRef = await addDoc(collection(db, "delivery_orders"), order);
      console.log("Pedido salvo com ID:", orderRef.id);

      for (const item of selectedItems) {
        const itemRef = ref(database, `estoque/${item.id}`);
        console.log(
          `Tentando atualizar estoque para item ${item.id}: ${item.quantity} - ${item.orderQuantity}`
        );
        try {
          const itemSnapshot = await get(itemRef);
          if (!itemSnapshot.exists()) {
            throw new Error(`Item ${item.id} não encontrado no estoque.`);
          }
          const currentQuantity = itemSnapshot.val().quantidade;
          const newQuantity = currentQuantity - item.orderQuantity;
          if (newQuantity < 0) {
            throw new Error(`Estoque insuficiente para item ${item.id}.`);
          }
          await update(itemRef, {
            quantidade: newQuantity,
          });
          console.log(
            `Estoque atualizado para item ${item.id}: ${newQuantity}`
          );
        } catch (updateError) {
          console.error(`Erro ao atualizar item ${item.id}:`, updateError);
          throw updateError;
        }
      }

      console.log("Iniciando impressão do pedido...");
      await printOrder({
        ...order,
        title: "Pedido Delivery",
      });

      Alert.alert("Sucesso", "Pedido confirmado e impresso!");
      setSelectedItems([]);
      setClientData({ name: "", phone: "", cpf: "" });
      setDeliveryData({
        address: "",
        neighborhood: "",
        reference: "",
        method: "Motoboy",
      });
      setSearchQuery("");
      setFilteredItems(items);
      setError("");
    } catch (error) {
      console.error("Erro ao confirmar pedido:", error);
      setError("Não foi possível processar o pedido: " + error.message);
    } finally {
      setLoading(false);
    }
  }, [clientData, deliveryData, selectedItems, items]);

  const renderItem = useCallback(
    ({ item }) => (
      <View style={styles.itemCard}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemText} numberOfLines={2} ellipsizeMode="tail">
            {item.name}
          </Text>
          <Text style={styles.itemSubText}>
            R${item.price?.toFixed(2) || "N/A"} | Estoque: {item.quantity || 0}
          </Text>
          <Text style={styles.itemCategory}>
            Categoria: {item.categoria || "N/A"}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => addItemToOrder(item)}
        >
          <Icon name="add-circle" size={24} color="#FFF" />
          <Text style={styles.addButtonText}>Adicionar</Text>
        </TouchableOpacity>
      </View>
    ),
    [addItemToOrder]
  );

  const renderSelectedItem = useCallback(
    ({ item, index }) => (
      <View key={`${item.id}-${index}`} style={styles.selectedItemCard}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemText} numberOfLines={1} ellipsizeMode="tail">
            {item.name}
          </Text>
          <Text style={styles.itemSubText}>
            R${(item.price * item.orderQuantity).toFixed(2)}
          </Text>
        </View>
        <View style={styles.quantityContainer}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => decrementQuantity(item.id)}
          >
            <Icon name="remove" size={18} color="#FFF" />
          </TouchableOpacity>
          <FocusableTextInput
            style={styles.quantityInput}
            keyboardType="numeric"
            value={item.orderQuantity.toString()}
            onChangeText={(text) => updateItemQuantity(item.id, text)}
            placeholderTextColor="#888"
            returnKeyType="done"
            onFocus={handleInputFocus}
            label=""
            placeholder=""
          />
          <TouchableOpacity
            style={[styles.quantityButton, styles.incrementButton]}
            onPress={() => incrementQuantity(item.id)}
          >
            <Icon name="add" size={18} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeItem(item.id)}
          >
            <Icon name="delete" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [
      decrementQuantity,
      incrementQuantity,
      removeItem,
      updateItemQuantity,
      handleInputFocus,
    ]
  );

  const renderHeader = useCallback(() => {
    console.log("renderHeader chamado");
    return (
      <View>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="shopping-cart" size={28} color="#FF6F00" />
            <Text style={styles.sectionTitle}>Itens Disponíveis</Text>
          </View>
          {filteredItems.length === 0 && !loading && !error ? (
            <Text style={styles.infoText}>
              {searchQuery
                ? "Nenhum item encontrado para a busca."
                : "Nenhum item disponível no estoque."}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }, [filteredItems, loading, error, searchQuery]);

  const renderFooter = useCallback(() => {
    const total = selectedItems.reduce(
      (sum, item) => sum + item.price * item.orderQuantity,
      0
    );
    return (
      <>
        {selectedItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name="check-circle" size={28} color="#FF6F00" />
              <Text style={styles.sectionTitle}>
                Itens Selecionados ({selectedItems.length})
              </Text>
            </View>
            <View style={styles.list}>
              {selectedItems.map((item, index) =>
                renderSelectedItem({ item, index })
              )}
            </View>
          </View>
        )}
        <View style={styles.footerContainer}>
          <Text style={styles.totalText}>Total: R${total.toFixed(2)}</Text>
          <TouchableOpacity
            style={[styles.confirmButton, loading && styles.disabledButton]}
            onPress={confirmOrder}
            disabled={loading}
          >
            <Text style={styles.confirmButtonText}>
              {loading ? "Confirmando..." : "Confirmar Pedido"}
            </Text>
            <Icon
              name="send"
              size={22}
              color="#FFF"
              style={styles.buttonIcon}
            />
          </TouchableOpacity>
        </View>
      </>
    );
  }, [selectedItems, loading, confirmOrder, renderSelectedItem]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "android" ? 80 : 0}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentContainer}>
          <Text style={styles.title}>Novo Pedido Delivery</Text>
          {error ? (
            <View style={styles.errorContainer}>
              <Icon name="error" size={20} color="#FF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          {loading && (
            <ActivityIndicator
              size="large"
              color="#FF6F00"
              style={styles.loader}
            />
          )}
          <SearchBar
            searchQuery={searchQuery}
            handleSearch={handleSearch}
            onInputFocus={handleInputFocus}
          />
          <ClientDataSection
            clientData={clientData}
            updateClientName={updateClientName}
            updateClientPhone={updateClientPhone}
            updateClientCpf={updateClientCpf}
            onInputFocus={handleInputFocus}
          />
          <DeliveryDataSection
            deliveryData={deliveryData}
            updateDeliveryAddress={updateDeliveryAddress}
            updateDeliveryNeighborhood={updateDeliveryNeighborhood}
            updateDeliveryReference={updateDeliveryReference}
            onInputFocus={handleInputFocus}
          />
        </View>
      </ScrollView>
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        extraData={selectedItems}
        contentContainerStyle={styles.flatListContent}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
    // marginTop: 70,
  },
  scrollContent: {
    flexGrow: 1,
    marginBottom: 5,
  },
  contentContainer: {
    padding: 20,
  },
  flatListContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 100, // Espaço para o botão fixo
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "#FF6F00",
  },
  section: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginLeft: 10,
  },
  inputContainer: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    width: "100%",
    height: 50,
    borderColor: "#DDD",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    backgroundColor: "#FFF",
    color: "#333",
    fontSize: 16,
  },
  inputActive: {
    borderColor: "#FF6F00",
    borderWidth: 2,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DDD",
    marginBottom: 20,
    paddingVertical: 4,
  },
  searchIcon: {
    marginLeft: 12,
  },
  searchInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#333",
  },
  list: {
    flexGrow: 0,
  },
  itemCard: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemInfo: {
    flex: 1,
  },
  itemText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#222",
    marginBottom: 4,
  },
  itemSubText: {
    fontSize: 14,
    color: "#555",
    marginBottom: 10,
  },
  itemCategory: {
    fontSize: 12,
    color: "#888",
    fontStyle: "italic",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF6F00",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  selectedItemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  quantityLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#555",
    marginRight: 8,
  },
  quantityInput: {
    width: 50,
    height: 40,
    borderColor: "#DDD",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: "#FFF",
    color: "#333",
    fontSize: 14,
    textAlign: "center",
  },
  quantityButton: {
    backgroundColor: "#555",
    padding: 8,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  incrementButton: {
    backgroundColor: "#FF6F00",
  },
  removeButton: {
    backgroundColor: "#FF4444",
    padding: 8,
    borderRadius: 8,
    marginLeft: 4,
  },
  footerContainer: {
    backgroundColor: "#FFF",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  totalText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6F00",
    paddingVertical: 16,
    borderRadius: 12,
  },
  disabledButton: {
    backgroundColor: "#888",
    opacity: 0.7,
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFF",
    marginRight: 8,
  },
  buttonIcon: {
    marginLeft: 4,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFE6E6",
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#FF4444",
    marginLeft: 8,
    flex: 1,
  },
  infoText: {
    fontSize: 16,
    color: "#555",
    marginBottom: 12,
    textAlign: "center",
  },
  loader: {
    marginVertical: 20,
  },
});

export default DeliveryScreen;
