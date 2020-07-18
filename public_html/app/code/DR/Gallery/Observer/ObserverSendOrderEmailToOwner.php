<?php

namespace DR\Gallery\Observer;

use Magento\Framework\Event\Observer;
use Magento\Framework\Event\ObserverInterface;
use Magento\Framework\App\Filesystem\DirectoryList;
use Magento\Framework\App\Request\DataPersistorInterface;
use Magento\Framework\App\ObjectManager;


class ObserverSendOrderEmailToOwner implements ObserverInterface {
	protected $_order;
	protected $scopeConfig;

    // \Magento\Framework\App\Config\ScopeConfigInterface $scopeConfig
    public function __construct(
        \Magento\Sales\Api\Data\OrderInterface $order
    ) {
         $this->_order = $order;    
         //$this->scopeConfig = $scopeConfig;
    }
	 public function execute(\Magento\Framework\Event\Observer $observer){
	   //echo $notifyEmail = $this->scopeConfig->getValue('trans_email/ident_custom1/email', $storeScope);
	  //      	$order_ids  = $observer->getEvent()->getOrderIds();
		 //    $order_id   = $order_ids[0];
 		// 	//$order_id   = 50;
		 //    //Loading order details

 		// 	$order = $this->_order->load($order_id);
 		// 	$items =$order->getAllVisibleItems();
		 //    //product ids
		 //    $productIds = array();
		 //    $message = '<html><body><h1 style="color:#f40;">Hi Admin</h1><p>You have a Order.</p>';
		 //    $message .= '<p>Order Id: #'.$order->getIncrementId().'. Please check your order below:</p>';
		 //    $message .= '<table style="width:100%" cellpadding="8" cellspacing="2" border="1">
			// 	        <thead>
			// 	            <tr class="headings">
			// 	                <th>Image </th>
			// 	                <th>Items</th>
			// 	                <th>Qty</th>
			// 	                <th>Price</th>
			// 	            </tr>
			// 	        </thead><tbody>';
			// $objectManager = \Magento\Framework\App\ObjectManager::getInstance();
			// $store = $objectManager->get('Magento\Store\Model\StoreManagerInterface')->getStore();
			// $resource = $objectManager->get('Magento\Framework\App\ResourceConnection');
			// $connection = $resource->getConnection();
			// $tableName = $resource->getTableName('frameeditor');
		 //    foreach($items as $item) {
			// 	$product2 = $objectManager->get('Magento\Catalog\Model\Product')->load($item->getProductId());
   //              $imageUrl = $store->getBaseUrl(\Magento\Framework\UrlInterface::URL_TYPE_MEDIA) . 'catalog/product' . $product2->getThumbnail();
   //              $img= "<img src='".$imageUrl."' width='108' />";
		 //    	$message .="<tr><td>".$img."</td>
		 //    	<td>".$item->getName()." <br>Sku: ".$item->getSku()."</td>
		 //    	<td>".floor($item->getQtyOrdered())."</td><td>".$item->getPrice()."</td></tr>";
		 //       	$sql = "Select * FROM " . $tableName. " Where frame='".$item->getProductId()."' and orderId='".$order_id."'";
   //          	$result = $connection->fetchAll($sql);

   //          	if(count($result)){
   //          		$product = $objectManager->get('Magento\Catalog\Model\Product')->load($result[0]['frameId']);
   //          		$store = $objectManager->get('Magento\Store\Model\StoreManagerInterface')->getStore();
   //                  $partsImageUrl = $store->getBaseUrl(\Magento\Framework\UrlInterface::URL_TYPE_MEDIA) . 'catalog/product' . $product->getThumbnail();
   //          		$e =explode("/",$result[0]['top_matt']);
   //                  $sql2 = "Select * FROM cf_matt Where Image='".end($e)."'";
   //                  $tmat = $connection->fetchAll($sql2);

   //                  $e =explode("/",$result[0]['bot_matt']);
   //                  $sql2 = "Select * FROM cf_matt Where Image='".end($e)."'";
   //                  $bmat = $connection->fetchAll($sql2);


   //                  $e =explode("/",$result[0]['embellishId']);
   //                  $name=$e[count($e)-3].'/'.$e[count($e)-2].'/'.$e[count($e)-1];
   //                  $sql3 = "Select * FROM cf_dr_gallery_image Where path='".$name."'";
   //                  $em = $connection->fetchAll($sql3);
   //                  $dimen=$result[0]["dimention"] == 1? "Horizontal":"Vertical";
   //                  $text=$result[0]["text"]!=""?$result[0]["text"]:"NA";
   //                  $fontsize=$result[0]["fontsize"]!=""?$result[0]["fontsize"]:"NA";
   //          		$message .='<tr>
   //                  <td colspan="4">
   //                      <table>
   //                          <tr>
   //                              <td>
   //                                  <table>
	  //                                   <tr>
	  //                                       <td colspan="4" style="border-bottom: 1px solid #ccc;">
	  //                                           <b>Frame: ('.$product->getSku().')</b>
	  //                                       </td>
	  //                                       <td colspan="1"  style="border-bottom: 1px solid #ccc;">
	  //                                               <img src='.$partsImageUrl.' width="10%" />
	  //                                       </td>
	  //                                   </tr>
	  //                                   <tr>
	  //                                       <td colspan="4"  style="border-bottom: 1px solid #ccc;">
	  //                                           <b>Dimension:</b>
	  //                                       </td>
	  //                                       <td colspan="1"  style="border-bottom: 1px solid #ccc;">
	  //                                           '.$dimen.'
	  //                                       </td>
	  //                                   </tr>
	  //                                   <tr>
	  //                                       <td colspan="4"  style="border-bottom: 1px solid #ccc;">
	  //                                           <b>Upload Image:</b>
	  //                                       </td>
	  //                                       <td colspan="1"  style="border-bottom: 1px solid #ccc;">
	  //                                           <img src='.$result[0]["Image"].' width="10%" />
	  //                                       </td>
	  //                                   </tr>
	  //                                   <tr>
	  //                                       <td colspan="4"  style="border-bottom: 1px solid #ccc;">
	                                            
	  //                                           <b>Top Matt: ('.$tmat[0]["Name"].')</b>
	  //                                       </td>
	  //                                       <td colspan="1"  style="border-bottom: 1px solid #ccc;">
	  //                                           <img src='.$result[0]["top_matt"].' width="10%" />
	  //                                       </td>
	  //                                   </tr>
	  //                                   <tr>
	  //                                       <td colspan="4"  style="border-bottom: 1px solid #ccc;">
	                                           
	  //                                           <b>Bottom Matt: ('.$bmat[0]["Name"].')</b>
	  //                                       </td>
	  //                                       <td colspan="1"  style="border-bottom: 1px solid #ccc;">
	  //                                           <img src='.$result[0]["bot_matt"].' width="10%" />
	  //                                       </td>
	  //                                   </tr>
	  //                                   <tr>
	  //                                       <td colspan="4  style="border-bottom: 1px solid #ccc;">
	                                           
	  //                                           <b>Embellishment: ('.$em[0]["name"].')</b>
	  //                                       </td>
	  //                                       <td colspan="1"  style="border-bottom: 1px solid #ccc;">
	  //                                           <img src='.$result[0]["embellishId"].' width="10%" />
	  //                                       </td>
	  //                                   </tr>
	  //                                   <tr>
	  //                                       <td colspan="4"  style="border-bottom: 1px solid #ccc;">
	  //                                           <b>Plate:</b>
	  //                                       </td>
	  //                                       <td colspan="1"  style="border-bottom: 1px solid #ccc;">
	  //                                           <img src='.$result[0]["plate"].' width="10%" />
	  //                                       </td>
	  //                                   </tr>
	  //                                   <tr>
	  //                                       <td colspan="4"  style="border-bottom: 1px solid #ccc;">
	  //                                           <b>Text:</b>
	  //                                       </td>
	  //                                       <td colspan="1"  style="border-bottom: 1px solid #ccc;">
	  //                                           '.$text.'
	  //                                       </td>
	  //                                   </tr>
	  //                                   <tr>
	  //                                       <td colspan="4"  style="border-bottom: 1px solid #ccc;">
	  //                                           <b>Font Size:</b>
	  //                                       </td>
	  //                                       <td colspan="1"  style="border-bottom: 1px solid #ccc;">
	  //                                           '.$fontsize.'
	  //                                       </td>
	  //                                   </tr>
	  //                                   <tr>
	  //                                       <td colspan="4"  style="border-bottom: 1px solid #ccc;">
	  //                                           <b>Font Family:</b>
	  //                                       </td>
	  //                                       <td colspan="1"  style="border-bottom: 1px solid #ccc;">
	  //                                           '.$result[0]["fontfamily"].'
	  //                                       </td>
	  //                                   </tr>
	  //                               </table>
   //                              </td>
   //                              <td style="width:30%">
   //                                 '.$img.'
   //                              </td>

   //                          </tr>
   //                      </table>
   //                  </td>

   //                  </tr>';
   //              }


		 //    }
			// $message .= '</tbody></table></body></html>';
	  //      	$to = 'somnath.mukherjee@dreamztech.com,biswajit.bose@dreamztech.com';
			// $subject = 'New Order #'.$order->getIncrementId();
			// $from = 'info@celebrityframing.com';

			// // To send HTML mail, the Content-type header must be set
			// $headers  = 'MIME-Version: 1.0' . "\r\n";
			// $headers .= 'Content-type: text/html; charset=iso-8859-1' . "\r\n";

			// // Create email headers
			// $headers .= 'From: '.$from."\r\n".
			//     'Reply-To: '.$from."\r\n" .
			//     'X-Mailer: PHP/' . phpversion();			 

			// mail($to, $subject, $message, $headers);

	        
	  }

}

