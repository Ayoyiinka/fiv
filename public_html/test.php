<?php

use Magento\Framework\App\Bootstrap;

include('app/bootstrap.php');

$bootstrap = Bootstrap::create(BP, $_SERVER);

$objectManager = $bootstrap->getObjectManager();
$state = $objectManager->get('Magento\Framework\App\State');
$state->setAreaCode('frontend');
$storeManager = $objectManager->get('Magento\Store\Model\StoreManagerInterface'); 
$currentStore = $storeManager->getStore();


    $orderData = $objectManager->create('Magento\Sales\Model\Order')->loadByIncrementId('000000042');
    $orderDetails=$orderData->getData();
    $items = $orderData->getAllItems();


    foreach($items as $i):
       	$_product = $objectManager->create('Magento\Catalog\Model\Product')->load($i->getProductId())->getSku();
   		//$sql = "Update " . $tableName . "Set emp_salary = 20000 where emp_id = 12";
		//$connection->query($sql);
        echo "<br/>Product Id=".$i->getProduct()->getAttributeSetId()."<br>Order Id=".$orderDetails['entity_id'].'<br>'.$_product.'<br>';
    endforeach;
?>
