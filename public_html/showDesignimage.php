<?php

use Magento\Framework\App\Bootstrap;

include('app/bootstrap.php');

$bootstrap = Bootstrap::create(BP, $_SERVER);

$objectManager = $bootstrap->getObjectManager();
$state = $objectManager->get('Magento\Framework\App\State');
$state->setAreaCode('frontend');
$storeManager = $objectManager->get('Magento\Store\Model\StoreManagerInterface'); 
$currentStore = $storeManager->getStore();
$product = $objectManager->create('Magento\Catalog\Model\Product')->load($_GET['id']);


echo '<img src="'.$currentStore->getBaseUrl(\Magento\Framework\UrlInterface::URL_TYPE_MEDIA).'catalog/product'.$product->getImage().'" />';

echo '<div style="text-align:center"><button onclick="window.print();">Print this page</button></div>';

?>
