<?php
/**
 *
 * Copyright © 2015 Framecommerce. All rights reserved.
 */
namespace Frame\Design\Controller\FrameDesign;

class Index extends \Magento\Framework\App\Action\Action
{

	protected $_cacheTypeList;

    /**
     * @var \Magento\Framework\App\Cache\StateInterface
     */
    protected $_cacheState;

    /**
     * @var \Magento\Framework\App\Cache\Frontend\Pool
     */
    protected $_cacheFrontendPool;

    /**
     * @var \Magento\Framework\View\Result\PageFactory
     */
    protected $resultPageFactory;

    protected $_productCollectionFactory;

    protected $_jsonHelper;

    protected $resultJsonFactory;

    protected $_productRepository;

    protected $_cart;

    /**
     * @param Action\Context $context
     * @param \Magento\Framework\App\Cache\TypeListInterface $cacheTypeList
     * @param \Magento\Framework\App\Cache\StateInterface $cacheState
     * @param \Magento\Framework\App\Cache\Frontend\Pool $cacheFrontendPool
     * @param \Magento\Framework\View\Result\PageFactory $resultPageFactory
     */
    public function __construct(
       \Magento\Framework\App\Action\Context $context,
        \Magento\Framework\App\Cache\TypeListInterface $cacheTypeList,
        \Magento\Framework\App\Cache\StateInterface $cacheState,
        \Magento\Framework\App\Cache\Frontend\Pool $cacheFrontendPool,
        \Magento\Framework\Registry $coreRegistry,
        \Magento\Catalog\Model\ResourceModel\Product\CollectionFactory $productCollectionFactory,
        \Magento\Framework\Controller\Result\JsonFactory $resultJsonFactory,
        \Magento\Framework\Json\Helper\Data $jsonHelper,
        \Magento\Framework\App\Filesystem\DirectoryList $directory_list,
        \Magento\Framework\View\Result\PageFactory $resultPageFactory,
        \Magento\Catalog\Model\ProductRepository $productRepository, 
        \Magento\Checkout\Model\Cart $cart
    ) {
        parent::__construct($context);
        $this->_cacheTypeList = $cacheTypeList;
        $this->_coreRegistry = $coreRegistry;
        $this->_cacheState = $cacheState;
        $this->_cacheFrontendPool = $cacheFrontendPool;
        $this->resultPageFactory = $resultPageFactory;
        $this->_jsonHelper = $jsonHelper;
        $this->resultJsonFactory = $resultJsonFactory;
        $this->directory_list = $directory_list; 
        $this->_productCollectionFactory = $productCollectionFactory;
        $this->_productRepository = $productRepository;
        $this->_cart = $cart;

    }
	
    private function _getFamily(){
        $objectManager = \Magento\Framework\App\ObjectManager::getInstance(); // Instance of object manager
        $resource = $objectManager->get('Magento\Framework\App\ResourceConnection');
        $connection = $resource->getConnection();
        $tableName = $resource->getTableName('fontfamily'); //gives table name with prefix
        
        //Select Data from table
        $sql = "Select * FROM " . $tableName;
        $result = $connection->fetchAll($sql);
        return $result;
    }

     private function _getMatt(){
        $objectManager = \Magento\Framework\App\ObjectManager::getInstance(); // Instance of object manager
        $resource = $objectManager->get('Magento\Framework\App\ResourceConnection');
        $connection = $resource->getConnection();
        $tableName = $resource->getTableName('matt'); //gives table name with prefix
        
        //Select Data from table
        $sql = "Select * FROM " . $tableName;
        $result = $connection->fetchAll($sql);
        return $result;
    }

    private function _getEmbellish(){
        $objectManager = \Magento\Framework\App\ObjectManager::getInstance(); // Instance of object manager
        $resource = $objectManager->get('Magento\Framework\App\ResourceConnection');
        $connection = $resource->getConnection();
        $tableName = $resource->getTableName('dr_gallery_image'); //gives table name with prefix
        $searchText = $this->getRequest()->getParam('searchText');
        $params ='';
        if($searchText!=''){
            $params= ' and name LIKE "%'.$searchText.'%"';
        }

        //Select Data from table
        $sql = "Select * FROM " . $tableName. " Where gallery_id=3".$params;
        $result = $connection->fetchAll($sql);
        return $result;
    }

    private function _saveDesignProducts($data){
        //print_r($data);
        $url = $data['canvasimg'];
        $img = $this->directory_list->getPath('media').'/frame/design/'.time().'.jpg';
        file_put_contents($img, file_get_contents($url));



        $objectManager = \Magento\Framework\App\ObjectManager::getInstance(); // Instance of object manager
        $resource = $objectManager->get('Magento\Framework\App\ResourceConnection');
        $connection = $resource->getConnection();
        $product = $objectManager->create('\Magento\Catalog\Model\Product');
        $product->setSku('CF_'.time()); // Set your sku here
        $product->setName('Custom Design Product'); // Name of Product
        $product->setAttributeSetId(9); // Attribute set id
        $product->setStatus(1); // Status on product enabled/ disabled 1/0
        //$product->setWeight(10); // weight of product
        $product->setVisibility(1); // visibilty of product (catalog / search / catalog, search / Not visible individually)
        $product->setTaxClassId(0); // Tax class id
        $product->setTypeId('simple'); // type of product (simple/virtual/downloadable/configurable)
        $product->setPrice($data['price']); // price of product
        $product->setData('frame_id', $data['frameId']);
        $product->setData('frame_width', $data['width']);
        $url = preg_replace('#[^0-9a-z]+#i', '-', 'Custom Design Product'.time());
        $url = strtolower($url);
        $product->setUrlKey($url);
        $product->setWebsiteIds(array(1));
        $product->setStockData(
                            array(
                                'use_config_manage_stock' => 0,
                                'manage_stock' => 1,
                                'is_in_stock' => 1,
                                'qty' => 10
                            )
                        );
        $imagePath =$img; // path of the image
        $product->addImageToMediaGallery($imagePath, array('image', 'small_image', 'thumbnail'), false, false);
        $product->save();

        $id = $product->getId();
        if(!isset($data['fontfamily'])){
            $fontfamily='Arial';
        }
        $tableName = $resource->getTableName('frameeditor'); //gives table name with prefix
        $sql = "Insert Into " . $tableName . " (frameId,dimention, Image, frame, top_matt, bot_matt, embellishId, plate, text, fontsize, fontfamily) Values ('".$data['frameId']."','".$data['dimension']."','".$data['image']."','".$id."','".$data['topmatt']."','".$data['bottommatt']."','".$data['embillish']."','".$data['plate']."','".$data['text']."','".$data['fontsize']."','".$fontfamily."')";
        $result = $connection->query($sql);

        $qty = 1;
        $params = array(
            'product' => $id,
            'qty' => $qty
        );

        $_product = $this->_productRepository->getById($id);
        $this->_cart->addProduct($_product,$params);
        $this->_cart->save();


        return $product;
    }
    /**
     * Flush cache storage
     *
     */
    public function execute()
    {
		
        $flag = $this->getRequest()->getParam('type');
      
        if ($this->getRequest()->isAjax() && $flag == 'family'){
            $attributes = $this->_getFamily();
            $result = $this->resultJsonFactory->create();
            return $result->setData($attributes);
        }
        else  if ($this->getRequest()->isAjax() && $flag == 'matt'){
            $attributes = $this->_getMatt();
            $result = $this->resultJsonFactory->create();
            return $result->setData($attributes);
        }
        else  if ($this->getRequest()->isAjax() && $flag == 'embellish'){
            $attributes = $this->_getEmbellish();
            $result = $this->resultJsonFactory->create();
            return $result->setData($attributes);
        }
         else  if ($this->getRequest()->isAjax() && $flag == 'save'){
            $data = $this->getRequest()->getParam('data');
            $attributes = $this->_saveDesignProducts($data);
            $result = $this->resultJsonFactory->create();
            return $result->setData($attributes);
        }
        else{
			$resultPage = $this->resultPageFactory->create();
			$resultPage->getConfig()->getTitle()->set('Frame Design');
            $this->_view->loadLayout();
            $this->_view->renderLayout();
            //$this->resultPage = $this->resultPageFactory->create();  
            //return $this->resultPage;
        }
    }
}
